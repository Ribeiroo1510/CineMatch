<?php
/**
 * CineMatch - Configuração da Base de Dados
 * Este ficheiro contém as configurações de ligação à base de dados MySQL
 */

// Configurações da base de dados
define('DB_HOST', '127.0.0.1');
define('DB_NAME', 'cinematch');
define('DB_USER', 'root');
define('DB_PASS', 'diogomiguel');
define('DB_CHARSET', 'utf8mb4');

/**
 * Função para estabelecer ligação à base de dados
 * @return PDO|null Retorna objeto PDO ou null em caso de erro
 */
function getDBConnection() {
    try {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        
        return new PDO($dsn, DB_USER, DB_PASS, $options);
    } catch (PDOException $e) {
        error_log("Erro na ligação à base de dados: " . $e->getMessage());
        return null;
    }
}

/**
 * Função para gerar código único de sessão
 * @return string Código de 6 caracteres alfanuméricos
 */
function generateSessionCode() {
    $characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $code = '';
    for ($i = 0; $i < 6; $i++) {
        $code .= $characters[rand(0, strlen($characters) - 1)];
    }
    return $code;
}

/**
 * Função para enviar resposta JSON
 * @param mixed $data Dados a enviar
 * @param int $status Código de status HTTP
 */
function sendJSONResponse($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Função para sanitizar input
 * @param string $input Input a sanitizar
 * @return string Input sanitizado
 */
function sanitizeInput($input) {
    return htmlspecialchars(strip_tags(trim($input)), ENT_QUOTES, 'UTF-8');
}
?>