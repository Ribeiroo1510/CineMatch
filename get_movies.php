<?php
/**
 * CineMatch - Endpoint para Obter Filmes
 * Retorna filmes da base de dados que o utilizador ainda não votou
 */

require_once 'config.php';

// Apenas aceitar GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendJSONResponse(['success' => false, 'message' => 'Método não permitido'], 405);
}

// Validar parâmetros obrigatórios
if (!isset($_GET['session_id']) || !isset($_GET['user_id'])) {
    sendJSONResponse(['success' => false, 'message' => 'Parâmetros em falta'], 400);
}

$sessionId = (int)$_GET['session_id'];
$userId = (int)$_GET['user_id'];

// Estabelecer ligação à base de dados
$pdo = getDBConnection();
if (!$pdo) {
    sendJSONResponse(['success' => false, 'message' => 'Erro na ligação à base de dados'], 500);
}

try {
    // Verificar se o utilizador pertence à sessão
    $stmt = $pdo->prepare("
        SELECT sp.id 
        FROM session_participants sp
        JOIN sessions s ON sp.session_id = s.id
        WHERE sp.session_id = ? AND sp.user_id = ? AND s.expires_at > NOW()
    ");
    $stmt->execute([$sessionId, $userId]);
    
    if (!$stmt->fetch()) {
        sendJSONResponse(['success' => false, 'message' => 'Utilizador não autorizado para esta sessão'], 403);
    }
    
    // Obter filmes que o utilizador ainda não votou
    $stmt = $pdo->prepare("
        SELECT m.id, m.title, m.poster_url, m.year, m.genre
        FROM movies m
        WHERE m.id NOT IN (
            SELECT v.movie_id 
            FROM votes v 
            WHERE v.session_id = ? AND v.user_id = ?
        )
        ORDER BY RAND()
    ");
    $stmt->execute([$sessionId, $userId]);
    $movies = $stmt->fetchAll();
    
    // Adicionar informações sobre votos existentes (opcional)
    foreach ($movies as &$movie) {
        // Contar votos existentes para este filme nesta sessão
        $stmt = $pdo->prepare("
            SELECT 
                COUNT(CASE WHEN vote = 'like' THEN 1 END) as likes,
                COUNT(CASE WHEN vote = 'dislike' THEN 1 END) as dislikes
            FROM votes 
            WHERE session_id = ? AND movie_id = ?
        ");
        $stmt->execute([$sessionId, $movie['id']]);
        $voteStats = $stmt->fetch();
        
        $movie['stats'] = [
            'likes' => (int)$voteStats['likes'],
            'dislikes' => (int)$voteStats['dislikes']
        ];
    }
    
    sendJSONResponse([
        'success' => true,
        'movies' => $movies,
        'total' => count($movies)
    ]);
    
} catch (Exception $e) {
    error_log("Erro ao obter filmes: " . $e->getMessage());
    sendJSONResponse(['success' => false, 'message' => 'Erro interno do servidor'], 500);
}
?>