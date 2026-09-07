const CONFIG = {
    discordUrl: "https://discord.gg/6s3fxxAUYV",
    siteUrl: "https://shop.astrea-deathrun.fr/",

    tips: [
        "Reste attentif aux bruits autour de toi.",
        "Ne reste pas trop longtemps au même endroit.",
        "Observe bien ton environnement avant d'avancer.",
        "La discrétion peut parfois être plus utile que la vitesse.",
        "Regarde derrière toi de temps en temps.",
        "Certains chemins sont plus sûrs que d'autres.",
        "Écoute avant de traverser une zone dangereuse.",
        "Si quelque chose te paraît suspect, éloigne-toi.",
        "Rester groupé peut aider, mais peut aussi vous rendre plus visibles.",
        "Les endroits sombres ne sont pas toujours les plus dangereux.",
        "Un bon timing peut faire la différence entre survivre et se faire attraper.",
        "Apprends les maps, elles peuvent te sauver la vie.",
        "Ne panique pas si tu es poursuivi.",
        "Utilise les obstacles pour casser la ligne de vue.",
        "Sur Astrea, même les couloirs peuvent réserver des surprises."
    ]
};

const state = {
    map: "fazbear hunt_school",
    maxPlayers: 16,
    filesTotal: 0,
    filesNeeded: 0,
    isGmod: false
};

const $ = (id) => document.getElementById(id);


/* =========================================================
   PROGRESSION
========================================================= */

function setProgress(value) {
    value = Math.max(0, Math.min(100, value));

    const progressBar = $("progress-bar");
    const progressValue = $("progress-value");

    if (progressBar) {
        progressBar.style.width = `${value}%`;
    }

    if (progressValue) {
        progressValue.textContent = `${Math.round(value)}%`;
    }
}


/* =========================================================
   MAP
========================================================= */

function setMap(mapname) {
    if (!mapname) return;

    state.map = mapname;

    const mapName = document.getElementById("map-name");
    const mapImage = document.getElementById("map-image");

    if (mapName) {
        mapName.textContent = mapname;
    }

    if (mapImage) {
        mapImage.onerror = function () {
            console.warn(`[Astrea] Image introuvable pour ${mapname}, utilisation de forgot.png`);
            this.onerror = null;
            this.src = "assets/forgot.png";
        };

        mapImage.src = `assets/maps/${mapname}.jpg`;
    }
}


/* =========================================================
   STEAM
========================================================= */

function steamIdTo64(steamId) {
    if (!steamId) {
        return null;
    }

    steamId = String(steamId).trim();

    // GMod peut parfois fournir directement le SteamID64.
    if (/^\d{17}$/.test(steamId)) {
        return steamId;
    }

    // Exemple :
    // STEAM_0:1:88070152
    const match = steamId.match(/^STEAM_[0-5]:([01]):(\d+)$/);

    if (!match) {
        console.error("[Astrea] SteamID invalide :", steamId);
        return null;
    }

    const y = BigInt(match[1]);
    const z = BigInt(match[2]);

    const steam64 =
        BigInt("76561197960265728") +
        (z * BigInt(2)) +
        y;

    return steam64.toString();
}


async function loadSteamProfile(steamId) {
    const playerName = $("player-name");
    const playerAvatar = $("player-avatar");

    const steam64 = steamIdTo64(steamId);

    if (!steam64) {
        console.error("[Astrea] Impossible de convertir le SteamID.");
        return;
    }

    console.log("[Astrea] SteamID64 :", steam64);

    try {
        const response = await fetch(
            `https://playerdb.co/api/player/steam/${steam64}`
        );

        if (!response.ok) {
            throw new Error(`Erreur HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.success || !data.data || !data.data.player) {
            throw new Error("Profil Steam introuvable");
        }

        const player = data.data.player;

        console.log("[Astrea] Profil Steam :", player);

        if (playerName) {
            playerName.textContent =
                player.username ||
                player.name ||
                "Joueur";
        }

        if (playerAvatar) {
            if (player.avatar) {
                playerAvatar.src = player.avatar;
            } else {
                playerAvatar.src = "assets/player-placeholder.svg";
            }

            playerAvatar.onerror = () => {
                playerAvatar.src = "assets/player-placeholder.svg";
                playerAvatar.onerror = null;
            };
        }

    } catch (error) {
        console.error(
            "[Astrea] Erreur récupération profil Steam :",
            error
        );

        if (playerName) {
            playerName.textContent = "Joueur";
        }

        if (playerAvatar) {
            playerAvatar.src = "assets/player-placeholder.svg";
        }
    }
}

/* =========================================================
   STAFF STEAM
========================================================= */

async function loadStaffProfile(row, steam64) {
    if (!row || !steam64) {
        return;
    }

    const avatar = row.querySelector("img");
    const name = row.querySelector(".staff-name");

    try {
        const response = await fetch(
            `https://playerdb.co/api/player/steam/${steam64}`
        );

        if (!response.ok) {
            throw new Error(`Erreur HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.success || !data.data || !data.data.player) {
            throw new Error("Profil Steam introuvable");
        }

        const player = data.data.player;

        if (name) {
            name.textContent =
                player.username ||
                player.name ||
                name.textContent;
        }

        if (avatar && player.avatar) {
            avatar.src = player.avatar;

            avatar.onerror = () => {
                avatar.src = "assets/staff-placeholder.svg";
                avatar.onerror = null;
            };
        }

    } catch (error) {
        console.error(
            `[Astrea] Impossible de charger le profil staff ${steam64} :`,
            error
        );
    }
}


async function loadStaffProfiles() {
    const rows = document.querySelectorAll(
        ".staff-row[data-steamid]"
    );

    if (!rows.length) {
        console.warn(
            "[Astrea] Aucun membre du staff trouvé dans le HTML."
        );

        return;
    }

    const requests = [];

    rows.forEach((row) => {
        const steam64 = row.dataset.steamid;

        if (!steam64) {
            return;
        }

        requests.push(
            loadStaffProfile(row, steam64)
        );
    });

    await Promise.allSettled(requests);

    console.log(
        "[Astrea] Profils du staff chargés."
    );
}

/* =========================================================
   FONCTIONS APPELÉES PAR GMOD
========================================================= */

window.GameDetails = function (
    serverName,
    serverUrl,
    mapName,
    maxPlayers,
    steamId,
    gamemode
) {
    state.isGmod = true;

    console.log("[Astrea] GameDetails reçu");
    console.log("[Astrea] Serveur :", serverName);
    console.log("[Astrea] Map :", mapName);
    console.log("[Astrea] Max joueurs :", maxPlayers);
    console.log("[Astrea] SteamID :", steamId);
    console.log("[Astrea] Gamemode :", gamemode);

    if (mapName) {
        setMap(mapName);
    }

    if (maxPlayers) {
        state.maxPlayers = Number(maxPlayers) || state.maxPlayers;

        const playersMax = $("players-max");

        if (playersMax) {
            playersMax.textContent = state.maxPlayers;
        }
    }

    if (gamemode) {
        const gamemodeName = $("gamemode-name");

        if (gamemodeName) {
            gamemodeName.textContent = gamemode;
        }
    }

    if (serverName) {
        const serverNameElement = $("server-name");

        if (serverNameElement) {
            serverNameElement.textContent = serverName;
        }
    }

    if (steamId) {
        loadSteamProfile(steamId);
    }
};


window.SetFilesTotal = function (total) {
    state.isGmod = true;

    state.filesTotal = Number(total) || 0;

    console.log(
        "[Astrea] Nombre total de fichiers :",
        state.filesTotal
    );
};


window.SetFilesNeeded = function (needed) {
    state.isGmod = true;

    state.filesNeeded = Number(needed) || 0;

    if (state.filesTotal > 0) {
        const downloaded =
            state.filesTotal - state.filesNeeded;

        const progress =
            (downloaded / state.filesTotal) * 100;

        setProgress(progress);
    }
};


window.DownloadingFile = function (fileName) {
    state.isGmod = true;

    const loadingFile = $("loading-file");

    if (!loadingFile) {
        return;
    }

    if (fileName) {
        loadingFile.textContent =
            `Téléchargement : ${fileName}`;
    } else {
        loadingFile.textContent =
            "Téléchargement...";
    }
};


window.SetStatusChanged = function (status) {
    state.isGmod = true;

    const statusText = $("status-text");
    const loadingFile = $("loading-file");

    const text =
        status ||
        "Connexion en cours";

    if (statusText) {
        statusText.textContent =
            text.toUpperCase();
    }

    console.log(
        "[Astrea] Statut :",
        text
    );

    /*
        Quand GMod arrive à "Sending client info",
        le téléchargement principal est terminé.
    */
    if (
        /sending client info/i.test(text) ||
        /client info sent/i.test(text) ||
        /starting lua/i.test(text) ||
        /lua started/i.test(text)
    ) {
        setProgress(100);
    
        if (loadingFile) {
            loadingFile.textContent =
                "Finalisation de la connexion...";
        }
    }
};


/* =========================================================
   INITIALISATION DU SITE
========================================================= */

function init() {
    const discordLink = $("discord-link");
    const siteLink = $("site-link");
    const tipText = $("tip-text");

    if (discordLink) {
        discordLink.href = CONFIG.discordUrl;
    }

    if (siteLink) {
        siteLink.href = CONFIG.siteUrl;
    }

    if (tipText && CONFIG.tips.length > 0) {
        const randomTip =
            CONFIG.tips[
                Math.floor(
                    Math.random() *
                    CONFIG.tips.length
                )
            ];

        tipText.textContent = randomTip;
    }

    setMap(state.map);

    const playersMax = $("players-max");

    if (playersMax) {
        playersMax.textContent =
            state.maxPlayers;
    }

    /*
        Valeurs d'attente avant que GMod
        envoie les vraies informations.
    */

    const playerName = $("player-name");
    const playerAvatar = $("player-avatar");

    if (playerName) {
        playerName.textContent =
            "Connexion...";
    }

    if (playerAvatar) {
        playerAvatar.src =
            "assets/player-placeholder.svg";
    }

    setProgress(0);

    loadStaffProfiles();
    loadServerPlayers();

    initMusicVisualizer();

    startBrowserDemo();
}


/* =========================================================
   MODE DÉMO NAVIGATEUR
========================================================= */

function startBrowserDemo() {
    /*
        Quand on ouvre directement GitHub Pages dans Chrome,
        GMod n'appelle évidemment pas GameDetails().

        Cette démo permet simplement de vérifier visuellement
        la barre de progression.

        Dès que GMod appelle une fonction,
        state.isGmod passe à true et la démo s'arrête.
    */

    let demoProgress = 0;

    const demoTimer = setInterval(() => {
        if (state.isGmod) {
            clearInterval(demoTimer);
            return;
        }

        demoProgress += 1;

        setProgress(demoProgress);

        if (demoProgress >= 100) {
            clearInterval(demoTimer);

            const statusText = $("status-text");
            const loadingFile = $("loading-file");

            if (statusText) {
                statusText.textContent =
                    "MODE APERÇU";
            }

            if (loadingFile) {
                loadingFile.textContent =
                    "Page ouverte hors de Garry's Mod";
            }
        }
    }, 100);
}


document.addEventListener(
    "DOMContentLoaded",
    init
);

const music = document.getElementById("loading-music");

if (music) {
    music.volume = 0.15;

    music.play().catch((error) => {
        console.log("[Astrea] Lecture automatique de la musique refusée :", error);
    });
}

function initMusicVisualizer() {
    const audio = document.getElementById("loading-music");
    const visualizer = document.getElementById("music-visualizer");

    if (!audio || !visualizer) return;

    const bars = visualizer.querySelectorAll("span");

    try {
        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContext) {
            console.warn("[Astrea] Web Audio API indisponible.");
            return;
        }

        const audioContext = new AudioContext();

        const source =
            audioContext.createMediaElementSource(audio);

        const analyser =
            audioContext.createAnalyser();

        analyser.fftSize = 64;

        source.connect(analyser);
        analyser.connect(audioContext.destination);

        const dataArray =
            new Uint8Array(analyser.frequencyBinCount);

        function animate() {
            analyser.getByteFrequencyData(dataArray);
        
            bars.forEach((bar, index) => {
                const value =
                    dataArray[index % dataArray.length];
        
                const height =
                    Math.max(4, (value / 255) * 30);
        
                bar.style.height = `${height}px`;
            });
        
            requestAnimationFrame(animate);
        }

        audio.play().then(() => {
            if (audioContext.state === "suspended") {
                audioContext.resume();
            }

            animate();
        }).catch((error) => {
            console.log(
                "[Astrea] Autoplay musique refusé :",
                error
            );
        });

    } catch (error) {
        console.error(
            "[Astrea] Visualiseur audio impossible :",
            error
        );
    }
}

async function loadServerPlayers() {
    const currentElement = document.getElementById("players-current");
    const maxElement = document.getElementById("players-max");

    try {
        const response = await fetch(
            "https://api.gamemonitoring.net/servers/14001441"
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.response) {
            throw new Error("Réponse GameMonitoring invalide");
        }

        currentElement.textContent = data.response.numplayers ?? "?";
        maxElement.textContent = data.response.maxplayers ?? "?";

    } catch (error) {
        console.error(
            "[Astrea] Impossible de récupérer les joueurs :",
            error
        );

        currentElement.textContent = "?";
    }
}

