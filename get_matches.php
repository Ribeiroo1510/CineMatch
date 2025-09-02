<?php
/**
 * CineMatch - Endpoint para Obter Matches da Sessão
 * Retorna todos os filmes que são considerados "matches" para uma sessão
 */

require_once 'config.php';

// Apenas aceitar GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendJSONResponse(['success' => false, 'message' => 'Método não permitido'], 405);
}

// Validar parâmetros obrigatórios
if (!isset($_GET['session_id'])) {
    sendJSONResponse(['success' => false, 'message' => 'Parâmetro session_id em falta'], 400);
}

$sessionId = (int)$_GET['session_id'];

// Estabelecer ligação à base de dados
$pdo = getDBConnection();
if (!$pdo) {
    sendJSONResponse(['success' => false, 'message' => 'Erro na ligação à base de dados'], 500);
}

try {
    // Verificar se a sessão existe e não expirou
    $stmt = $pdo->prepare("
        SELECT id FROM sessions WHERE id = ? AND expires_at > NOW()
    ");
    $stmt->execute([$sessionId]);

    if (!$stmt->fetch()) {
        sendJSONResponse(['success' => false, 'message' => 'Sessão inválida ou expirada'], 404);
    }

    // Contar quantos participantes há na sessão para determinar o critério de match
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as total_participants
        FROM session_participants
        WHERE session_id = ?
    ");
    $stmt->execute([$sessionId]);
    $totalParticipants = $stmt->fetch()['total_participants'];

    // O critério de match é pelo menos 2 likes
    $minLikesForMatch = 2;

    // Obter todos os filmes que são matches nesta sessão
    $stmt = $pdo->prepare("
        SELECT
            m.id AS movie_id,
            m.title,
            m.poster_url,
            m.year,
            m.genre,
            COUNT(v.id) AS like_count,
            GROUP_CONCAT(DISTINCT u.name ORDER BY u.name ASC SEPARATOR ',') AS users_who_liked
        FROM votes v
        JOIN movies m ON v.movie_id = m.id
        JOIN users u ON v.user_id = u.id
        WHERE v.session_id = ? AND v.vote = 'like'
        GROUP BY m.id, m.title, m.poster_url, m.year, m.genre
        HAVING COUNT(v.id) >= ?
        ORDER BY like_count DESC, m.title ASC
    ");
    $stmt->execute([$sessionId, $minLikesForMatch]);
    $matches = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Processar a string de utilizadores para um array
    foreach ($matches as &$match) {
        $match['users_who_liked'] = explode(',', $match['users_who_liked']);
    }

    sendJSONResponse([
        'success' => true,
        'matches' => $matches,
        'total_matches' => count($matches)
    ]);

} catch (Exception $e) {
    error_log("Erro ao obter matches: " . $e->getMessage());
    sendJSONResponse(['success' => false, 'message' => 'Erro interno do servidor'], 500);
}
?>