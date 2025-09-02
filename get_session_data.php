<?php
/**
 * CineMatch - Endpoint para Obter Dados da Sessão
 * Retorna a contagem e lista de participantes de uma sessão
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

    // Contar participantes na sessão
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as participant_count
        FROM session_participants
        WHERE session_id = ?
    ");
    $stmt->execute([$sessionId]);
    $participantCount = $stmt->fetch()['participant_count'];

    // Obter lista de participantes
    $stmt = $pdo->prepare("
        SELECT u.name
        FROM session_participants sp
        JOIN users u ON sp.user_id = u.id
        WHERE sp.session_id = ?
        ORDER BY sp.joined_at
    ");
    $stmt->execute([$sessionId]);
    $participants = $stmt->fetchAll(PDO::FETCH_ASSOC); // Fetch as associative array to get 'name'

    sendJSONResponse([
        'success' => true,
        'participant_count' => (int)$participantCount,
        'participants' => $participants
    ]);

} catch (Exception $e) {
    error_log("Erro ao obter dados da sessão: " . $e->getMessage());
    sendJSONResponse(['success' => false, 'message' => 'Erro interno do servidor'], 500);
}
?>