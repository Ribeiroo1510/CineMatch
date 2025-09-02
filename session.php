<?php
/**
 * CineMatch - Interface Principal de Votação
 * Página onde os utilizadores votam nos filmes
 */

require_once 'config.php';

// Verificar parâmetros necessários
if (!isset($_GET['code']) || !isset($_GET['user_id'])) {
    header('Location: index.php');
    exit;
}

$sessionCode = sanitizeInput($_GET['code']);
$userId = (int)$_GET['user_id'];

// Verificar se a sessão existe e não expirou
$pdo = getDBConnection();
if (!$pdo) {
    die('Erro na ligação à base de dados');
}

try {
    // Verificar sessão
    $stmt = $pdo->prepare("
        SELECT s.id, s.code, s.created_at, u.name as user_name
        FROM sessions s
        JOIN session_participants sp ON s.id = sp.session_id
        JOIN users u ON sp.user_id = u.id
        WHERE s.code = ? AND sp.user_id = ? AND s.expires_at > NOW()
    ");
    $stmt->execute([$sessionCode, $userId]);
    $sessionData = $stmt->fetch();

    if (!$sessionData) {
        header('Location: index.php');
        exit;
    }

    $sessionId = $sessionData['id'];
    $userName = $sessionData['user_name'];

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
    $participants = $stmt->fetchAll(PDO::FETCH_COLUMN);

} catch (Exception $e) {
    die('Erro ao verificar sessão: ' . $e->getMessage());
}
?>

<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CineMatch - Sessão <?= htmlspecialchars($sessionCode) ?></title>

    <!-- PWA Meta Tags -->
    <meta name="theme-color" content="#1a1a2e">
    <meta name="description" content="Vote nos seus filmes favoritos no CineMatch">

    <!-- PWA Manifest -->
    <link rel="manifest" href="manifest.json">

    <!-- Apple Touch Icons -->
    <link rel="apple-touch-icon" href="icons/icon-192x192.png">

    <!-- CSS -->
    <link rel="stylesheet" href="css/style.css">

    <!-- Passar SESSION_ID para JavaScript -->
    <meta name="session-id" content="<?= $sessionId ?>">

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400..900&display=swap" rel="stylesheet">

    <!-- Icon -->
    <link rel="icon" type="png" href="Logo_Background.png">

    <!-- Font Awesome -->
    <script src="https://kit.fontawesome.com/93218baf27.js" crossorigin="anonymous"></script>
</head>
<body>
    <div class="container">
        <header class="session-header">
            <h1>CineMatch</h1>
            <p>Deslize para encontrar o filme perfeito</p>
        </header>

        <main class="voting-main">
            <!-- Loading state -->
            <div id="loadingState" class="loading-state">
                <div class="spinner"></div>
                <p>A carregar filmes...</p>
            </div>

            <!-- Movie voting area -->
            <div id="votingArea" class="voting-area" style="display: none;">
                <div id="movieCard" class="movie-card">
                    <!-- Movie content will be loaded here -->
                </div>

                <div class="voting-buttons">
                    <button id="dislikeBtn" class="vote-btn dislike-btn">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                    <button id="likeBtn" class="vote-btn like-btn">
                        <i class="fa-regular fa-heart"></i>
                    </button>
                </div>

                <div class="voting-progress">
                    <div class="progress-info">
                        <span id="currentMovie">1</span> de <span id="totalMovies">-</span> filmes
                    </div>
                    <div class="progress-bar">
                        <div id="progressFill" class="progress-fill"></div>
                    </div>
                </div>
            </div>

            <!-- No more movies state -->
            <div id="noMoviesState" class="no-movies-state" style="display: none;">
                <div class="completion-message">
                    <h2>Votação Completa!</h2>
                    <p>Votou em todos os filmes disponíveis.</p>
                    <p>Aguarde que outros participantes terminem as suas votações para encontrar matches.</p>
                </div>
            </div>

            <!-- Match notifications -->
            <div id="matchNotification" class="match-notification" style="display: none;">
                <div class="match-content">
                    <h3>Match Encontrado!</h3>
                    <div id="matchMovieInfo"></div>
                    <button onclick="closeMatchNotification()" class="btn btn-small">Fechar</button>
                </div>
            </div>
        </main>

        <!-- BOTTOM NAV -->
        <div class="bottom-nav">
            <a href="index.php" class="session-btn" style="text-decoration: none;">
                <i class="fa-solid fa-house"></i>
            </a>

            <button class="session-btn" id="sessionBtn" onclick="openSession()">
                <i class="fa-solid fa-users"></i>
                <div class="participant-count" id="participantCount"><?= $participantCount ?></div>
            </button>
            <div class="session-modal" id="sessionModal">
                <div class="session" id="session">
                    <div class="session-header" style="display:flex; align-items:center; justify-content:space-between;">
                        <div class="session-title" style="font-weight:600; font-size: 20px; color: #FFD700; margin: 0;">Detalhes da Sessão</div>
                        <button class="btn btn-small" onclick="closeSession()" aria-label="Fechar modal">✕</button>
                    </div>

                    <div class="session-info">
                        <div class="session-details">
                            <p><strong>Sessão:</strong> <?= htmlspecialchars($sessionCode) ?></p>
                            <p><strong>Utilizador:</strong> <?= htmlspecialchars($userName) ?></p>
                            <p><strong>Participantes:</strong> <span id="participantCount"><?= $participantCount ?></span></p>
                        </div>
                        <button class="btn btn-small" onclick="shareSession()">Partilhar Código</button>
                    </div>

                    <div class="participants-list">
                        <h4>Participantes:</h4>
                        <div class="participants" id="participantsDisplay">
                            <?php foreach ($participants as $participant): ?>
                                <span class="participant-tag"><?= htmlspecialchars($participant) ?></span>
                            <?php endforeach; ?>
                        </div>
                    </div>
                </div>
            </div>

            <button class="matches-btn" id="matchesBtn" onclick="openMatches()">
                <i class="fa-solid fa-handshake-angle"></i>
                <div class="matches-count" id="matchesCount">0</div>
            </button>
            <!-- Matches Section -->
            <div class="matches-modal" id="matchesModal">
                <div class="matches-section">
                    <div class="matches-header" style="display:flex; align-items:center; justify-content:space-between;">
                        <h2>Matches da Sessão</h2>
                        <button class="btn btn-small" onclick="closeMatches()" aria-label="Fechar modal">✕</button>
                    </div>
                    <div id="matchesDisplay" class="matches-grid">
                        <p class="no-matches-message">Nenhum match encontrado ainda. Continue a votar!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <footer style="text-align: center;">
        &copy; <a target="_blank" href="https://diogooribeiro.netlify.app/" style="text-decoration: none; color: #fff;">Diogo Ribeiro</a> | 2025
    </footer>

    <!-- JavaScript -->
    <script src="js/app.js"></script>
    <script>
        const sessionModal = document.getElementById('sessionModal');
        const matchesModal = document.getElementById('matchesModal');

        function openSession() {
            sessionModal.style.display = 'block';
            sessionModal.style.zIndex = '1000';
        }

        function closeSession() {
            sessionModal.style.display = 'none';
        }

        function openMatches() {
            matchesModal.style.display = 'block';
        }

        function closeMatches() {
            matchesModal.style.display = 'none';
        }
    </script>
</body>
</html>
