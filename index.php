<?php
/**
 * CineMatch - Página Inicial
 * Interface para criar nova sessão ou entrar numa sessão existente
 */

require_once 'config.php';

// Processar criação de sessão
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    $pdo = getDBConnection();
    
    if (!$pdo) {
        $error = "Erro na ligação à base de dados";
    } else {
        if ($_POST['action'] === 'create_session') {
            $userName = sanitizeInput($_POST['user_name']);
            
            if (empty($userName)) {
                $error = "Por favor, insira o seu nome";
            } else {
                try {
                    $pdo->beginTransaction();
                    
                    // Criar utilizador
                    $stmt = $pdo->prepare("INSERT INTO users (name) VALUES (?)");
                    $stmt->execute([$userName]);
                    $userId = $pdo->lastInsertId();
                    
                    // Gerar código único para a sessão
                    do {
                        $sessionCode = generateSessionCode();
                        $stmt = $pdo->prepare("SELECT id FROM sessions WHERE code = ?");
                        $stmt->execute([$sessionCode]);
                    } while ($stmt->fetch());
                    
                    // Criar sessão
                    $stmt = $pdo->prepare("INSERT INTO sessions (code) VALUES (?)");
                    $stmt->execute([$sessionCode]);
                    $sessionId = $pdo->lastInsertId();
                    
                    // Adicionar utilizador à sessão
                    $stmt = $pdo->prepare("INSERT INTO session_participants (session_id, user_id) VALUES (?, ?)");
                    $stmt->execute([$sessionId, $userId]);
                    
                    $pdo->commit();
                    
                    // Redirecionar para a sessão
                    header("Location: session.php?code=$sessionCode&user_id=$userId");
                    exit;
                    
                } catch (Exception $e) {
                    $pdo->rollBack();
                    $error = "Erro ao criar sessão: " . $e->getMessage();
                }
            }
        } elseif ($_POST['action'] === 'join_session') {
            $userName = sanitizeInput($_POST['user_name']);
            $sessionCode = sanitizeInput($_POST['session_code']);
            
            if (empty($userName) || empty($sessionCode)) {
                $error = "Por favor, preencha todos os campos";
            } else {
                try {
                    $pdo->beginTransaction();
                    
                    // Verificar se a sessão existe
                    $stmt = $pdo->prepare("SELECT id FROM sessions WHERE code = ? AND expires_at > NOW()");
                    $stmt->execute([$sessionCode]);
                    $session = $stmt->fetch();
                    
                    if (!$session) {
                        $error = "Código de sessão inválido ou expirado";
                    } else {
                        // Criar utilizador
                        $stmt = $pdo->prepare("INSERT INTO users (name) VALUES (?)");
                        $stmt->execute([$userName]);
                        $userId = $pdo->lastInsertId();
                        
                        // Adicionar utilizador à sessão
                        $stmt = $pdo->prepare("INSERT INTO session_participants (session_id, user_id) VALUES (?, ?)");
                        $stmt->execute([$session['id'], $userId]);
                        
                        $pdo->commit();
                        
                        // Redirecionar para a sessão
                        header("Location: session.php?code=$sessionCode&user_id=$userId");
                        exit;
                    }
                } catch (Exception $e) {
                    $pdo->rollBack();
                    $error = "Erro ao entrar na sessão: " . $e->getMessage();
                }
            }
        }
    }
}
?>

<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CineMatch - Encontre o Filme Perfeito</title>
    
    <!-- PWA Meta Tags -->
    <meta name="theme-color" content="#1a1a2e">
    <meta name="description" content="Encontre filmes em comum com amigos no CineMatch">
    
    <!-- PWA Manifest -->
    <link rel="manifest" href="manifest.json">
    
    <!-- Apple Touch Icons -->
    <link rel="apple-touch-icon" href="icons/icon-192x192.png">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    
    <!-- Favicon -->
    <link rel="icon" type="image/png" sizes="32x32" href="icons/icon-192x192.png">
    
    <!-- CSS -->
    <link rel="stylesheet" href="css/style.css">

    <!-- Icon -->
    <link rel="icon" type="png" href="Logo_Background.png">

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400..900&display=swap" rel="stylesheet">
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>CineMatch</h1>
            <p>Descubra filmes em comum com os seus amigos</p>
        </header>

        <main class="main">
            <?php if (isset($error)): ?>
                <div class="alert alert-error">
                    <?= htmlspecialchars($error) ?>
                </div>
            <?php endif; ?>

            <div class="forms-container">
                <!-- Formulário para criar sessão -->
                <div class="form-card">
                    <h2>Criar Nova Sessão</h2>
                    <form method="POST" class="form">
                        <input type="hidden" name="action" value="create_session">
                        
                        <div class="form-group">
                            <label for="create_user_name">O seu nome:</label>
                            <input type="text" id="create_user_name" name="user_name" required 
                                   placeholder="Insira o seu nome" maxlength="50">
                        </div>
                        
                        <button type="submit" class="btn btn-primary">
                            Criar Sessão
                        </button>
                    </form>
                </div>

                <!-- Formulário para entrar numa sessão -->
                <div class="form-card">
                    <h2>Entrar numa Sessão</h2>
                    <form method="POST" class="form">
                        <input type="hidden" name="action" value="join_session">
                        
                        <div class="form-group">
                            <label for="join_user_name">O seu nome:</label>
                            <input type="text" id="join_user_name" name="user_name" required 
                                   placeholder="Insira o seu nome" maxlength="50">
                        </div>
                        
                        <div class="form-group">
                            <label for="session_code">Código da sessão:</label>
                            <input type="text" id="session_code" name="session_code" required 
                                   placeholder="Ex: ABC123" maxlength="6" pattern="[A-Za-z0-9]{6}"
                                   style="text-transform: uppercase;">
                        </div>
                        
                        <button type="submit" class="btn btn-primary">
                            Entrar na Sessão
                        </button>
                    </form>
                </div>
            </div>

            <!-- Botão de instalação PWA -->
            <div class="install-section" id="installSection" style="display: none;">
                <div class="install-card">
                    <h3>Instalar CineMatch</h3>
                    <p>Instale o CineMatch no seu dispositivo para acesso rápido</p>
                    <button id="installBtn" class="btn btn-install">
                        Instalar App
                    </button>
                </div>
            </div>
        </main>

        <footer style="text-align: center;">
            &copy; <a target="_blank" href="https://diogooribeiro.netlify.app/" style="text-decoration: none; color: #fff;">Diogo Ribeiro</a> | 2025
        </footer>
    </div>

    <!-- JavaScript -->
    <script>
        // PWA Installation
        let deferredPrompt;
        const installSection = document.getElementById('installSection');
        const installBtn = document.getElementById('installBtn');

        // Registar Service Worker
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('service-worker.js')
                    .then(registration => {
                        console.log('Service Worker registado com sucesso:', registration.scope);
                    })
                    .catch(error => {
                        console.log('Falha ao registar Service Worker:', error);
                    });
            });
        }

        // Mostrar botão de instalação quando disponível
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            installSection.style.display = 'block';
        });

        // Gerir instalação
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                
                if (outcome === 'accepted') {
                    installSection.style.display = 'none';
                }
                
                deferredPrompt = null;
            }
        });

        // Esconder botão após instalação
        window.addEventListener('appinstalled', () => {
            installSection.style.display = 'none';
            console.log('CineMatch instalado com sucesso');
        });

        // Auto-uppercase no código da sessão
        document.getElementById('session_code').addEventListener('input', function(e) {
            e.target.value = e.target.value.toUpperCase();
        });
    </script>
</body>
</html>