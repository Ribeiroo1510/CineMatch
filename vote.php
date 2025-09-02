<?php
/**
 * CineMatch - Endpoint para Registar Votos
 * Processa votos dos utilizadores e verifica matches
 */

require_once 'config.php';

// Apenas aceitar POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJSONResponse(['success' => false, 'message' => 'Método não permitido'], 405);
}

// Obter dados JSON do request
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    sendJSONResponse(['success' => false, 'message' => 'Dados inválidos'], 400);
}

// Validar dados obrigatórios
$required_fields = ['session_id', 'user_id', 'movie_id', 'vote'];
foreach ($required_fields as $field) {
    if (!isset($input[$field])) {
        sendJSONResponse(['success' => false, 'message' => "Campo obrigatório em falta: $field"], 400);
    }
}

$sessionId = (int)$input['session_id'];
$userId = (int)$input['user_id'];
$movieId = (int)$input['movie_id'];
$vote = $input['vote'];

// Validar tipo de voto
if (!in_array($vote, ['like', 'dislike'])) {
    sendJSONResponse(['success' => false, 'message' => 'Tipo de voto inválido'], 400);
}

// Estabelecer ligação à base de dados
$pdo = getDBConnection();
if (!$pdo) {
    sendJSONResponse(['success' => false, 'message' => 'Erro na ligação à base de dados'], 500);
}

try {
    $pdo->beginTransaction();

    // Verificar se o utilizador pertence à sessão
    $stmt = $pdo->prepare("
        SELECT sp.id
        FROM session_participants sp
        JOIN sessions s ON sp.session_id = s.id
        WHERE sp.session_id = ? AND sp.user_id = ? AND s.expires_at > NOW()
    ");
    $stmt->execute([$sessionId, $userId]);

    if (!$stmt->fetch()) {
        $pdo->rollBack();
        sendJSONResponse(['success' => false, 'message' => 'Utilizador não autorizado para esta sessão'], 403);
    }

    // Verificar se o filme existe
    $stmt = $pdo->prepare("SELECT id, title, poster_url, year, genre FROM movies WHERE id = ?");
    $stmt->execute([$movieId]);
    $movie = $stmt->fetch();

    if (!$movie) {
        $pdo->rollBack();
        sendJSONResponse(['success' => false, 'message' => 'Filme não encontrado'], 404);
    }

    // Verificar se o utilizador já votou neste filme nesta sessão
    $stmt = $pdo->prepare("
        SELECT id FROM votes
        WHERE session_id = ? AND user_id = ? AND movie_id = ?
    ");
    $stmt->execute([$sessionId, $userId, $movieId]);

    if ($stmt->fetch()) {
        $pdo->rollBack();
        sendJSONResponse(['success' => false, 'message' => 'Já votou neste filme'], 409);
    }

    // Registar o voto
    $stmt = $pdo->prepare("
        INSERT INTO votes (session_id, user_id, movie_id, vote)
        VALUES (?, ?, ?, ?)
    ");
    $stmt->execute([$sessionId, $userId, $movieId, $vote]);

    $response = ['success' => true, 'message' => 'Voto registado com sucesso'];

    // Verificar se há match (apenas para likes)
    if ($vote === 'like') {
        $match = checkForMatch($pdo, $sessionId, $movieId, $userId);
        if ($match) {
            $response['match'] = $match;
        }
    }

    $pdo->commit();
    sendJSONResponse($response);

} catch (Exception $e) {
    $pdo->rollBack();
    error_log("Erro ao processar voto: " . $e->getMessage());
    sendJSONResponse(['success' => false, 'message' => 'Erro interno do servidor'], 500);
}

/**
 * Verificar se existe match para um filme numa sessão
 * @param PDO $pdo Ligação à base de dados
 * @param int $sessionId ID da sessão
 * @param int $movieId ID do filme
 * @param int $currentUserId ID do utilizador atual
 * @return array|null Dados do match ou null se não houver match
 */
function checkForMatch($pdo, $sessionId, $movieId, $currentUserId) {
    try {
        // Contar quantos participantes há na sessão
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as total_participants
            FROM session_participants
            WHERE session_id = ?
        ");
        $stmt->execute([$sessionId]);
        $totalParticipants = $stmt->fetch()['total_participants'];

        // Se há apenas 1 participante, não pode haver match
        if ($totalParticipants < 2) {
            return null;
        }

        // Contar quantos likes este filme tem nesta sessão
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as like_count,
                   GROUP_CONCAT(u.name ORDER BY u.name ASC SEPARATOR ', ') as users_who_liked
            FROM votes v
            JOIN users u ON v.user_id = u.id
            WHERE v.session_id = ? AND v.movie_id = ? AND v.vote = 'like'
        ");
        $stmt->execute([$sessionId, $movieId]);
        $result = $stmt->fetch();

        $likeCount = (int)$result['like_count'];

        // Para haver match, precisa de pelo menos 2 likes
        if ($likeCount >= 2) {
            // Obter dados do filme para retornar
            $stmt = $pdo->prepare("
                SELECT id, title, poster_url, year, genre
                FROM movies
                WHERE id = ?
            ");
            $stmt->execute([$movieId]);
            $movieData = $stmt->fetch();

            if ($movieData) {
                return [
                    'movie_id' => $movieId,
                    'title' => $movieData['title'],
                    'poster_url' => $movieData['poster_url'],
                    'year' => $movieData['year'],
                    'genre' => $movieData['genre'],
                    'like_count' => $likeCount,
                    'users_who_liked' => explode(', ', $result['users_who_liked']) // Split by ', '
                ];
            }
        }

        return null;

    } catch (Exception $e) {
        error_log("Erro ao verificar match: " . $e->getMessage());
        return null;
    }
}
?>