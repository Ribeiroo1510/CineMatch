/**
 * CineMatch - JavaScript Principal
 * Lógica front-end para votação e interações
 */

// Configuração global
const CINEMATCH = {
    // URLs da API
    API: {
        MOVIES: 'get_movies.php',
        VOTE: 'vote.php',
        SESSION_DATA: 'get_session_data.php', // Novo endpoint para dados da sessão
        MATCHES: 'get_matches.php' // Novo endpoint para matches
    },

    // Estados da aplicação
    STATE: {
        LOADING: 'loading',
        VOTING: 'voting',
        COMPLETED: 'completed',
        ERROR: 'error'
    },

    // Configurações
    CONFIG: {
        AUTO_CLOSE_MATCH: 5000, // 5 segundos
        KEYBOARD_SHORTCUTS: true,
        ANIMATIONS: true,
        SESSION_UPDATE_INTERVAL: 5000 // 5 segundos para atualizar dados da sessão
    }
};

/**
 * Classe principal da aplicação CineMatch
 */
class CineMatchApp {
    constructor() {
        this.movies = [];
        this.currentMovieIndex = 0;
        this.votedMovies = new Set();
        this.state = CINEMATCH.STATE.LOADING;
        this.sessionData = null;
        this.matchTimeouts = [];
        this.sessionUpdateIntervalId = null; // Para o intervalo de atualização da sessão

        this.init();
    }

    /**
     * Inicializar aplicação
     */
    init() {
        console.log('CineMatch: Inicializando aplicação...');

        // Verificar se estamos na página de sessão
        if (!this.isSessionPage()) {
            console.log('CineMatch: Não é uma página de sessão');
            return;
        }

        // Obter dados da sessão da URL
        this.sessionData = this.getSessionDataFromURL();

        if (!this.sessionData) {
            console.error('CineMatch: Dados da sessão inválidos');
            this.redirectToHome();
            return;
        }

        // Configurar elementos DOM
        this.setupDOMElements();

        // Configurar event listeners
        this.setupEventListeners();

        // Carregar filmes
        this.loadMovies();

        // Iniciar atualização periódica dos dados da sessão
        this.startSessionDataUpdate();

        // Carregar e exibir matches iniciais
        this.loadAndDisplayMatches();

        console.log('CineMatch: Aplicação inicializada com sucesso');
    }

    /**
     * Verificar se estamos numa página de sessão
     */
    isSessionPage() {
        return window.location.pathname.includes('session.php') ||
            document.getElementById('votingArea') !== null;
    }

    /**
     * Obter dados da sessão da URL
     */
    getSessionDataFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const userId = urlParams.get('user_id');

        if (!code || !userId) {
            return null;
        }

        return {
            code: code,
            userId: parseInt(userId),
            sessionId: this.getSessionIdFromPage()
        };
    }

    /**
     * Obter session ID da página (definido no PHP)
     */
    getSessionIdFromPage() {
        // Tentar obter de um elemento hidden ou meta tag
        const metaSessionId = document.querySelector('meta[name="session-id"]');
        if (metaSessionId) {
            return parseInt(metaSessionId.content);
        }

        // Fallback para a variável global SESSION_ID (se ainda existir)
        if (typeof SESSION_ID !== 'undefined') {
            return SESSION_ID;
        }

        return null;
    }

    /**
     * Redirecionar para página inicial
     */
    redirectToHome() {
        window.location.href = 'index.php';
    }

    /**
     * Configurar elementos DOM
     */
    setupDOMElements() {
        this.elements = {
            loadingState: document.getElementById('loadingState'),
            votingArea: document.getElementById('votingArea'),
            noMoviesState: document.getElementById('noMoviesState'),
            movieCard: document.getElementById('movieCard'),
            likeBtn: document.getElementById('likeBtn'),
            dislikeBtn: document.getElementById('dislikeBtn'),
            currentMovie: document.getElementById('currentMovie'),
            totalMovies: document.getElementById('totalMovies'),
            progressFill: document.getElementById('progressFill'),
            matchNotification: document.getElementById('matchNotification'),
            matchMovieInfo: document.getElementById('matchMovieInfo'),
            participantCount: document.getElementById('participantCount'),
            participantsDisplay: document.getElementById('participantsDisplay'),
            matchesDisplay: document.getElementById('matchesDisplay'),
            matchesCount: document.getElementById('matchesCount')
        };

        // Verificar se todos os elementos necessários existem
        const missingElements = Object.entries(this.elements)
            .filter(([key, element]) => !element)
            .map(([key]) => key);

        if (missingElements.length > 0) {
            console.warn('⚠️ CineMatch: Elementos DOM em falta:', missingElements);
        }
    }

    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        // Botões de votação
        if (this.elements.likeBtn) {
            this.elements.likeBtn.addEventListener('click', () => this.vote('like'));
        }

        if (this.elements.dislikeBtn) {
            this.elements.dislikeBtn.addEventListener('click', () => this.vote('dislike'));
        }

        // Efeitos hover nos botões de votação
        dislikeBtn.addEventListener("mouseenter", () => {
            movieCard.style.transform = 'translateX(-30px) rotate(-3deg)';
        });

        dislikeBtn.addEventListener("mouseleave", () => {
            movieCard.style.transform = 'translateX(0) rotate(0)';
        });

        likeBtn.addEventListener("mouseenter", () => {
            movieCard.style.transform = 'translateX(30px) rotate(3deg)';
        });

        likeBtn.addEventListener("mouseleave", () => {
            movieCard.style.transform = 'translateX(0) rotate(0)';
        });


        // Atalhos de teclado
        if (CINEMATCH.CONFIG.KEYBOARD_SHORTCUTS) {
            document.addEventListener('keydown', (e) => {
                if (this.state !== CINEMATCH.STATE.VOTING) return;

                switch (e.key) {
                    case 'ArrowLeft':
                    case 'a':
                    case 'A':
                        e.preventDefault();
                        this.vote('dislike');
                        break;
                    case 'ArrowRight':
                    case 'd':
                    case 'D':
                        e.preventDefault();
                        this.vote('like');
                        break;
                    case 'Escape':
                        this.closeMatchNotification();
                        break;
                }
            });
        }

        // Gestos para dispositivos móveis (swipe)
        this.setupTouchGestures();

        // Visibilidade da página (pausar/retomar quando muda de aba)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.onPageHidden();
            } else {
                this.onPageVisible();
            }
        });
    }

    /**
     * Configurar gestos touch para dispositivos móveis
     */
    setupTouchGestures() {
        let startX = 0;
        let startY = 0;

        if (this.elements.movieCard) {
            this.elements.movieCard.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            });

            this.elements.movieCard.addEventListener('touchend', (e) => {
                if (!startX || !startY) return;

                const endX = e.changedTouches[0].clientX;
                const endY = e.changedTouches[0].clientY;

                const diffX = startX - endX;
                const diffY = startY - endY;

                // Verificar se é um swipe horizontal
                if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
                    if (diffX > 0) {
                        // Swipe left - dislike
                        this.vote('dislike');
                    } else {
                        // Swipe right - like
                        this.vote('like');
                    }
                }

                startX = 0;
                startY = 0;
            });
        }
    }

    /**
     * Carregar filmes da API
     */
    async loadMovies() {
        console.log('CineMatch: Carregando filmes...');

        this.setState(CINEMATCH.STATE.LOADING);

        try {
            const url = `${CINEMATCH.API.MOVIES}?session_id=${this.sessionData.sessionId}&user_id=${this.sessionData.userId}`;

            const response = await fetch(url);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `Erro HTTP: ${response.status}`);
            }

            if (data.success) {
                this.movies = data.movies || [];

                console.log(`CineMatch: ${this.movies.length} filmes carregados`);

                if (this.elements.totalMovies) {
                    this.elements.totalMovies.textContent = this.movies.length;
                }

                if (this.movies.length > 0) {
                    this.setState(CINEMATCH.STATE.VOTING);
                    this.displayCurrentMovie();
                } else {
                    this.setState(CINEMATCH.STATE.COMPLETED);
                }
            } else {
                throw new Error(data.message || 'Resposta da API inválida');
            }

        } catch (error) {
            console.error('CineMatch: Erro ao carregar filmes:', error);
            this.handleError('Erro ao carregar filmes. Tente recarregar a página.');
        }
    }

    /**
     * Definir estado da aplicação
     */
    setState(newState) {
        console.log(`CineMatch: Estado alterado de ${this.state} para ${newState}`);

        this.state = newState;

        // Esconder todos os estados
        if (this.elements.loadingState) this.elements.loadingState.style.display = 'none';
        if (this.elements.votingArea) this.elements.votingArea.style.display = 'none';
        if (this.elements.noMoviesState) this.elements.noMoviesState.style.display = 'none';

        // Mostrar o estado atual
        switch (newState) {
            case CINEMATCH.STATE.LOADING:
                if (this.elements.loadingState) this.elements.loadingState.style.display = 'block';
                break;

            case CINEMATCH.STATE.VOTING:
                if (this.elements.votingArea) this.elements.votingArea.style.display = 'block';
                break;

            case CINEMATCH.STATE.COMPLETED:
                if (this.elements.noMoviesState) this.elements.noMoviesState.style.display = 'block';
                break;

            case CINEMATCH.STATE.ERROR:
                // Estado de erro pode ser tratado com um alert ou elemento específico
                break;
        }
    }

    /**
     * Exibir filme atual
     */
    displayCurrentMovie() {
        if (this.currentMovieIndex >= this.movies.length) {
            this.setState(CINEMATCH.STATE.COMPLETED);
            return;
        }

        const movie = this.movies[this.currentMovieIndex];

        if (!movie || !this.elements.movieCard) {
            console.error('CineMatch: Erro ao exibir filme');
            return;
        }

        console.log(`CineMatch: Exibindo filme ${this.currentMovieIndex + 1}/${this.movies.length}: ${movie.title}`);

        // Criar HTML do filme com fallback para poster
        const posterUrl = movie.poster_url || 'https://via.placeholder.com/300x450/333/fff?text=Poster+Indisponível';
        const year = movie.year || 'N/A';
        const genre = movie.genre || 'N/A';

        this.elements.movieCard.innerHTML = `
            <div class="movie-poster">
                <img src="${this.escapeHtml(posterUrl)}"
                     alt="${this.escapeHtml(movie.title)}"
                     onerror="this.src='https://via.placeholder.com/300x450/333/fff?text=Poster+Indisponível'"
                     loading="lazy">
            </div>
            <div class="movie-info">
                <h2>${this.escapeHtml(movie.title)}</h2>
                <div class="movie-meta">
                    <span class="movie-year">${this.escapeHtml(year)}</span>
                    <span class="movie-genre">${this.escapeHtml(genre)}</span>
                </div>
            </div>
        `;

        this.updateProgress();

        // Adicionar animação se ativada
        if (CINEMATCH.CONFIG.ANIMATIONS) {
            this.elements.movieCard.style.opacity = '0';
            this.elements.movieCard.style.transform = 'translateY(20px)';

            setTimeout(() => {
                this.elements.movieCard.style.transition = 'all 0.3s ease';
                this.elements.movieCard.style.opacity = '1';
                this.elements.movieCard.style.transform = 'translateY(0)';
            }, 100);
        }
    }

    /**
     * Atualizar barra de progresso
     */
    updateProgress() {
        if (this.elements.currentMovie) {
            this.elements.currentMovie.textContent = this.currentMovieIndex + 1;
        }

        if (this.elements.progressFill && this.movies.length > 0) {
            const progress = ((this.currentMovieIndex + 1) / this.movies.length) * 100;
            this.elements.progressFill.style.width = `${progress}%`;
        }
    }

    /**
     * Votar num filme
     */
    async vote(voteType) {
        if (this.state !== CINEMATCH.STATE.VOTING || this.currentMovieIndex >= this.movies.length) {
            console.warn('⚠️ CineMatch: Tentativa de voto inválida');
            return;
        }

        const movie = this.movies[this.currentMovieIndex];

        if (!movie) {
            console.error('CineMatch: Filme não encontrado');
            return;
        }

        console.log(`CineMatch: Votando ${voteType} em "${movie.title}"`);

        // Desabilitar botões durante o voto
        this.setVotingButtonsEnabled(false);

        try {
            const response = await fetch(CINEMATCH.API.VOTE, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: this.sessionData.sessionId,
                    user_id: this.sessionData.userId,
                    movie_id: movie.id,
                    vote: voteType
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `Erro HTTP: ${response.status}`);
            }

            if (data.success) {
                console.log('CineMatch: Voto registado com sucesso');

                // Verificar se houve match
                if (data.match) {
                    console.log('CineMatch: Match encontrado!', data.match);
                    this.showMatchNotification(data.match);
                    this.loadAndDisplayMatches(); // Atualizar lista de matches
                }

                // Adicionar animação de saída se ativada
                if (CINEMATCH.CONFIG.ANIMATIONS) {
                    this.animateMovieExit(voteType);
                } else {
                    this.proceedToNextMovie();
                }

            } else {
                throw new Error(data.message || 'Resposta da API inválida');
            }

        } catch (error) {
            console.error('CineMatch: Erro ao votar:', error);
            this.handleError('Erro ao registar voto. Tente novamente.');
        } finally {
            // Reabilitar botões
            this.setVotingButtonsEnabled(true);
        }
    }

    /**
     * Animar saída do filme após voto
     */
    animateMovieExit(voteType) {
        if (!this.elements.movieCard) {
            this.proceedToNextMovie();
            return;
        }

        const direction = voteType === 'like' ? '100%' : '-100%';
        const rotation = voteType === 'like' ? '45deg' : '-45deg';

        this.elements.movieCard.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        this.elements.movieCard.style.transform = `translateX(${direction}) rotate(${rotation})`;
        this.elements.movieCard.style.opacity = '0';

        setTimeout(() => {
            this.proceedToNextMovie();
        }, 300);
    }

    /**
     * Proceder para o próximo filme
     */
    proceedToNextMovie() {
        const currentMovie = this.movies[this.currentMovieIndex];

        if (currentMovie) {
            this.votedMovies.add(currentMovie.id);
        }

        this.currentMovieIndex++;

        if (this.currentMovieIndex < this.movies.length) {
            this.displayCurrentMovie();
        } else {
            console.log('CineMatch: Todos os filmes votados');
            this.setState(CINEMATCH.STATE.COMPLETED);
        }
    }

    /**
     * Ativar/desativar botões de votação
     */
    setVotingButtonsEnabled(enabled) {
        if (this.elements.likeBtn) {
            this.elements.likeBtn.disabled = !enabled;
        }
        if (this.elements.dislikeBtn) {
            this.elements.dislikeBtn.disabled = !enabled;
        }
    }

    /**
     * Mostrar notificação de match
     */
    showMatchNotification(matchData) {
        if (!this.elements.matchNotification || !this.elements.matchMovieInfo) {
            console.warn('⚠️ CineMatch: Elementos de match não encontrados');
            return;
        }

        console.log('CineMatch: Exibindo notificação de match');

        // Criar HTML da notificação
        const posterUrl = matchData.poster_url || 'https://via.placeholder.com/80x120/333/fff?text=Poster';
        const year = matchData.year || 'N/A';
        const genre = matchData.genre || 'N/A';

        this.elements.matchMovieInfo.innerHTML = `
            <div class="match-movie">
                <img src="${this.escapeHtml(posterUrl)}"
                     alt="${this.escapeHtml(matchData.title)}"
                     class="match-poster"
                     onerror="this.src='https://via.placeholder.com/80x120/333/fff?text=Poster'">
                <div class="match-details">
                    <h4>${this.escapeHtml(matchData.title)}</h4>
                    <p>${this.escapeHtml(year)} • ${this.escapeHtml(genre)}</p>
                    <p><strong>${matchData.like_count}</strong> ${matchData.like_count === 1 ? 'like' : 'likes'}</p>
                    <p>Com: ${matchData.users_who_liked.map(name => this.escapeHtml(name)).join(', ')}</p>
                </div>
            </div>
        `;

        // Mostrar notificação com animação
        this.elements.matchNotification.style.display = 'flex';

        if (CINEMATCH.CONFIG.ANIMATIONS) {
            this.elements.matchNotification.style.opacity = '0';
            setTimeout(() => {
                this.elements.matchNotification.style.transition = 'opacity 0.3s ease';
                this.elements.matchNotification.style.opacity = '1';
            }, 10);
        }

        // Auto-close após tempo configurado
        const timeoutId = setTimeout(() => {
            this.closeMatchNotification();
        }, CINEMATCH.CONFIG.AUTO_CLOSE_MATCH);

        this.matchTimeouts.push(timeoutId);

        // Reproduzir som de notificação se disponível
        this.playNotificationSound();
    }

    /**
     * Fechar notificação de match
     */
    closeMatchNotification() {
        if (!this.elements.matchNotification) return;

        console.log('CineMatch: Fechando notificação de match');

        // Limpar timeouts pendentes
        this.matchTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.matchTimeouts = [];

        if (CINEMATCH.CONFIG.ANIMATIONS) {
            this.elements.matchNotification.style.transition = 'opacity 0.3s ease';
            this.elements.matchNotification.style.opacity = '0';

            setTimeout(() => {
                this.elements.matchNotification.style.display = 'none';
            }, 300);
        } else {
            this.elements.matchNotification.style.display = 'none';
        }
    }

    /**
     * Reproduzir som de notificação
     */
    playNotificationSound() {
        try {
            // Criar e reproduzir som usando Web Audio API
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);

            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);

        } catch (error) {
            console.warn('⚠️ CineMatch: Não foi possível reproduzir som de notificação:', error);
        }
    }

    /**
     * Lidar com erros
     */
    handleError(message) {
        console.error('CineMatch: Erro:', message);

        this.setState(CINEMATCH.STATE.ERROR);

        // Mostrar mensagem de erro
        if (typeof message === 'string') {
            alert(message);
        }

        // Reabilitar botões se necessário
        this.setVotingButtonsEnabled(true);
    }

    /**
     * Escapar HTML para prevenir XSS
     */
    escapeHtml(text) {
        if (typeof text !== 'string') return text;

        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Quando a página fica oculta
     */
    onPageHidden() {
        console.log('CineMatch: Página oculta');
        // Pausar atualização da sessão
        if (this.sessionUpdateIntervalId) {
            clearInterval(this.sessionUpdateIntervalId);
            this.sessionUpdateIntervalId = null;
            console.log('⏸CineMatch: Atualização da sessão pausada');
        }
    }

    /**
     * Quando a página fica visível
     */
    onPageVisible() {
        console.log('CineMatch: Página visível');
        // Retomar atualização da sessão
        if (!this.sessionUpdateIntervalId) {
            this.startSessionDataUpdate();
            console.log('▶CineMatch: Atualização da sessão retomada');
        }
    }

    /**
     * Iniciar atualização periódica dos dados da sessão (participantes)
     */
    startSessionDataUpdate() {
        if (this.sessionUpdateIntervalId) {
            clearInterval(this.sessionUpdateIntervalId);
        }
        this.sessionUpdateIntervalId = setInterval(() => {
            this.updateSessionParticipants();
            this.loadAndDisplayMatches(); // Também atualiza os matches
        }, CINEMATCH.CONFIG.SESSION_UPDATE_INTERVAL);
        console.log(`CineMatch: Atualização da sessão iniciada a cada ${CINEMATCH.CONFIG.SESSION_UPDATE_INTERVAL / 1000} segundos`);
    }

    /**
     * Atualizar a lista de participantes da sessão
     */
    async updateSessionParticipants() {
        if (!this.sessionData || !this.elements.participantsDisplay || !this.elements.participantCount) {
            return;
        }

        try {
            const url = `${CINEMATCH.API.SESSION_DATA}?session_id=${this.sessionData.sessionId}`;
            const response = await fetch(url);
            const data = await response.json();

            if (response.ok && data.success) {
                const participants = data.participants || [];
                const participantCount = data.participant_count || 0;

                // Atualizar contagem
                this.elements.participantCount.textContent = participantCount;

                // Atualizar lista de participantes
                this.elements.participantsDisplay.innerHTML = '';
                if (participants.length > 0) {
                    participants.forEach(p => {
                        const span = document.createElement('span');
                        span.classList.add('participant-tag');
                        span.textContent = this.escapeHtml(p.name);
                        this.elements.participantsDisplay.appendChild(span);
                    });
                } else {
                    this.elements.participantsDisplay.innerHTML = '<p>Nenhum participante ainda.</p>';
                }
                console.log('CineMatch: Participantes da sessão atualizados.');
            } else {
                console.warn('⚠️ CineMatch: Falha ao atualizar participantes:', data.message || 'Erro desconhecido');
            }
        } catch (error) {
            console.error('CineMatch: Erro ao buscar participantes:', error);
        }
    }

    /**
     * Carregar e exibir todos os matches da sessão
     */
    async loadAndDisplayMatches() {
        if (!this.sessionData || !this.elements.matchesDisplay) {
            return;
        }

        try {
            const url = `${CINEMATCH.API.MATCHES}?session_id=${this.sessionData.sessionId}`;
            const response = await fetch(url);
            const data = await response.json();

            if (response.ok && data.success) {
                const matches = data.matches || [];
                this.elements.matchesDisplay.innerHTML = '';

                if (matches.length > 0) {
                    matches.forEach(match => {
                        const matchCard = document.createElement('div');
                        matchCard.classList.add('match-card-item');
                        const posterUrl = match.poster_url || 'https://via.placeholder.com/100x150/333/fff?text=Poster';
                        const year = match.year || 'N/A';
                        const genre = match.genre || 'N/A';

                        matchCard.innerHTML = `
                            <img src="${this.escapeHtml(posterUrl)}" alt="${this.escapeHtml(match.title)}" class="match-item-poster" onerror="this.src='https://via.placeholder.com/100x150/333/fff?text=Poster'">
                            <div class="match-item-details">
                                <h4>${this.escapeHtml(match.title)}</h4>
                                <p>${this.escapeHtml(year)} • ${this.escapeHtml(genre)}</p>
                                <p>${match.like_count} likes</p>
                                <p>Com: ${match.users_who_liked.map(name => this.escapeHtml(name)).join(', ')}</p>
                            </div>
                        `;
                        this.elements.matchesDisplay.appendChild(matchCard);
                    });
                } else {
                    this.elements.matchesDisplay.innerHTML = '<p class="no-matches-message">Nenhum match encontrado ainda. Continue a votar!</p>';
                }

                matchesCount.innerText = matches.length;
                console.log(`CineMatch: ${matches.length} matches carregados e exibidos.`);
            } else {
                console.warn('⚠️ CineMatch: Falha ao carregar matches:', data.message || 'Erro desconhecido');
            }
        } catch (error) {
            console.error('CineMatch: Erro ao buscar matches:', error);
        }
    }
}

/**
 * Funções utilitárias globais
 */

/**
 * Partilhar código da sessão
 */
function shareSession() {
    // Acessar o código da sessão da instância da aplicação
    const sessionCode = window.cineMatchApp ? window.cineMatchApp.sessionData.code : null;

    if (!sessionCode) {
        console.warn('⚠️ CineMatch: SESSION_CODE não definido na instância da aplicação');
        showToast('Não foi possível obter o código da sessão para partilhar.', 4000);
        return;
    }

    const sessionUrl = window.location.origin + window.location.pathname.replace('session.php', 'index.php');
    const shareText = `Junta-te à minha sessão CineMatch!\nCódigo: ${sessionCode}\nLink: ${sessionUrl}`;

    if (navigator.share) {
        navigator.share({
            title: 'CineMatch - Sessão ' + sessionCode,
            text: shareText,
            url: sessionUrl
        }).catch(error => {
            console.log('⚠️ CineMatch: Erro ao partilhar:', error);
            fallbackShare(shareText);
        });
    } else {
        fallbackShare(shareText);
    }
}

/**
 * Partilha fallback para browsers sem suporte nativo
 */
function fallbackShare(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Código copiado para a área de transferência!');
        }).catch(() => {
            promptShare(text);
        });
    } else {
        promptShare(text);
    }
}

/**
 * Prompt manual para partilha
 */
function promptShare(text) {
    const result = prompt('Copie este texto para partilhar:', text);
    if (result !== null) {
        showToast('Texto selecionado!');
    }
}

/**
 * Mostrar toast notification
 */
function showToast(message, duration = 3000) {
    // Criar elemento toast se não existir
    let toast = document.getElementById('cinematch-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'cinematch-toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(233, 69, 96, 0.9);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: all 0.3s ease;
            opacity: 0;
            pointer-events: none;
        `;
        document.body.appendChild(toast);
    }

    // Mostrar toast
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.pointerEvents = 'auto';

    // Esconder após duração especificada
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.pointerEvents = 'none';
    }, duration);
}

/**
 * Fechar notificação de match (função global para uso em HTML)
 */
function closeMatchNotification() {
    if (window.cineMatchApp) {
        window.cineMatchApp.closeMatchNotification();
    }
}

/**
 * Inicialização quando DOM estiver pronto
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎬 CineMatch: DOM carregado');

    // Criar instância global da aplicação
    window.cineMatchApp = new CineMatchApp();

    // Adicionar classe CSS para indicar que JS está ativo
    document.body.classList.add('js-active');

    // Log de informações do browser
    console.log('📱 CineMatch: User Agent:', navigator.userAgent);
    console.log('🌐 CineMatch: URL:', window.location.href);
});

/**
 * Lidar com erros JavaScript globais
 */
window.addEventListener('error', (event) => {
    console.error('💥 CineMatch: Erro JavaScript global:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
    });
});

/**
 * Lidar com promessas rejeitadas
 */
window.addEventListener('unhandledrejection', (event) => {
    console.error('💥 CineMatch: Promessa rejeitada não tratada:', event.reason);
    event.preventDefault(); // Prevenir log no console do browser
});