'use strict';
/* Spanish: menus, stages, profile, leaderboard, errors, page metadata. Games live in es/<game file>.js */
/* touch screens: reword click/mouse hints after translating them */
I18N.addTouch('es', [[/\bHAZ CLIC\b/g, 'TOCA'], [/\bCLIC\b/g, 'TOCA'], [/\b(MOUSE|RATÓN)\b/g, 'DEDO']]);
I18N.add('es', {
  /* page */
  'Claude Ware': 'Claude Ware',
  'Claude Ware: a fast-paced WarioWare-style game with 100+ five-second microgames, 10 stages and bosses. Play free in your browser, with optional profiles and global leaderboards.':
    'Claude Ware: un juego rápido estilo WarioWare con más de 100 microjuegos de cinco segundos, 10 etapas y jefes. Juega gratis en tu navegador, con perfiles opcionales y rankings globales.',
  'Claude Ware: 100+ five-second microgames': 'Claude Ware: más de 100 microjuegos de cinco segundos',
  'Fast 5-second microgames, 10 stages and bosses. Play free in your browser, then challenge your friends to beat your score.':
    'Microjuegos de 5 segundos, 10 etapas y jefes. Juega gratis en tu navegador y reta a tus amigos a superar tu puntaje.',
  'Fast 5-second microgames, 10 stages and bosses. Play free, then challenge your friends.':
    'Microjuegos de 5 segundos, 10 etapas y jefes. Juega gratis y reta a tus amigos.',
  'Rotate your phone for a bigger screen': 'Gira tu teléfono para una pantalla más grande',
  'New username': 'Nuevo nombre de usuario',
  'NEW NAME': 'NUEVO NOMBRE',

  /* stages */
  'BUG HUNT': 'CAZA DE BUGS', 'Click it. Squash it.': 'Haz clic. Aplástalo.',
  'KEYBOARD KINGDOM': 'REINO DEL TECLADO', 'Fingers on the keys!': '¡Dedos al teclado!',
  'REFLEX RUSH': 'FIEBRE DE REFLEJOS', 'Faster. Then faster.': 'Más rápido. Y más.',
  'MOUSE MAYHEM': 'LOCURA DE MOUSE', 'Point, drag, scrub!': '¡Apunta, arrastra, frota!',
  'BRAIN BREAK': 'DESCANSO MENTAL', 'Think fast!': '¡Piensa rápido!',
  'MEGA MIX': 'SUPER MEZCLA', 'Everything. At once.': 'Todo. A la vez.',
  'WII WAGGLE': 'AGITA Y GANA', 'Smooth moves, Claude!': '¡Con estilo, Claude!',
  'CUBE PARTY': 'FIESTA CUBO', 'Mega party game, mega fast!': '¡Mega fiesta, mega rápido!',
  'TOUCH SCREEN': 'PANTALLA TÁCTIL', 'Poke it. Draw it. Cut it.': 'Toca. Dibuja. Corta.',
  'GET TOGETHER': 'A JUNTARSE', 'Stay still. Pick. Run. Fry.': 'Quieto. Elige. Corre. Fríe.',
  '3D DIMENSION': 'DIMENSIÓN 3D', 'Now with depth!': '¡Ahora con profundidad!',
  'MEGA MICROGAME$': 'MEGA MICROJUEGO$', 'Old-school. Four colours. Go!': 'Old school. Cuatro colores. ¡Vamos!',
  'TWISTED!': '¡RETORCIDO!', 'Tilt it. Spin it. Steer it!': '¡Inclina. Gira. Maneja!',
  'MOVE IT!': '¡MUÉVETE!', 'Strike a pose. Hit the beat!': '¡Pon la pose. Sigue el ritmo!',

  /* title / menus */
  'A FRIEND': 'UN AMIGO',
  '{from} CHALLENGES YOU: BEAT {score} ON {stage}': '{from} TE RETA: SUPERA {score} EN {stage}',
  '{games} MICROGAMES · {stages} STAGES · MOUSE + KEYBOARD + TOUCH': '{games} MICROJUEGOS · {stages} ETAPAS · MOUSE + TECLADO + TÁCTIL',
  'TAP TO ACCEPT': 'TOCA PARA ACEPTAR', 'CLICK TO ACCEPT': 'HAZ CLIC PARA ACEPTAR',
  'TAP TO START': 'TOCA PARA EMPEZAR', 'CLICK OR PRESS ENTER': 'CLIC O PRESIONA ENTER',
  'MUTED · M = SOUND': 'SILENCIO · M = SONIDO', 'M = MUTE': 'M = SILENCIAR',
  'INVITE': 'INVITAR', 'MENU ►': 'MENÚ ►',
  'SELECT STAGE': 'ELIGE ETAPA', 'STAGE {n}': 'ETAPA {n}', 'LOCKED': 'BLOQUEADA',
  'PAGE {n}/{total}': 'PÁG. {n}/{total}',
  'PRACTICE': 'PRÁCTICA', 'TITLE': 'INICIO', 'RANKS': 'RANKING', 'PROFILE': 'PERFIL',
  '1-6 STAGE · ◄ ► PAGE · P PRACTICE · L RANKS · A PROFILE · ESC BACK': '1-6 ETAPA · ◄ ► PÁGINA · P PRÁCTICA · L RANKING · A PERFIL · ESC VOLVER',
  '◄ BACK': '◄ VOLVER', 'SPEED x{n}': 'VELOCIDAD x{n}',
  'CURSED DISCO. NO REFUNDS.': 'DISCO MALDITA. SIN REEMBOLSOS.',
  '{n} GAMES + BOSS': '{n} JUEGOS + JEFE', 'GAME {n} / {total}': 'JUEGO {n} / {total}',

  /* in game */
  'READY?': '¿LISTO?', 'AGAIN!': '¡OTRA VEZ!', 'BOSS!': '¡JEFE!', 'BOSS': 'JEFE', 'GET READY!': '¡PREPÁRATE!',
  'SPEED UP!': '¡MÁS RÁPIDO!', 'NICE!': '¡BIEN!', 'OUCH!': '¡AUCH!', 'FAIL!': '¡FALLASTE!',
  'SCORE {n}': 'PUNTOS {n}', 'EXIT': 'SALIR', 'MENU': 'MENÚ',
  'GAME OVER': 'FIN DEL JUEGO', '{stage} · SCORE {n}': '{stage} · PUNTOS {n}',
  'RETRY': 'REINTENTAR', 'SHARE': 'COMPARTIR', 'STAGES': 'ETAPAS',
  'YOU SHIPPED IT!': '¡LO LANZASTE!', 'STAGE CLEAR!': '¡ETAPA SUPERADA!',
  'SCORE {n}  NEW BEST!': 'PUNTOS {n}  ¡NUEVO RÉCORD!', 'SCORE {n}  BEST {best}': 'PUNTOS {n}  RÉCORD {best}',
  'NEXT ►': 'SIGUIENTE ►',
  'YOU BEAT {from}\'S {score}!': '¡SUPERASTE LOS {score} DE {from}!',
  '{from}\'S SCORE: {score} · {left} TO GO': 'PUNTOS DE {from}: {score} · FALTAN {left}',

  /* online */
  'GUEST · SIGN IN WITH GOOGLE (PROFILE) TO JOIN THE LEADERBOARD': 'INVITADO · INICIA SESIÓN CON GOOGLE (PERFIL) PARA ENTRAR AL RANKING',
  'RANKING...': 'CALCULANDO RANKING...', '#{rank} ON {stage}!': '¡#{rank} EN {stage}!',
  'OFFLINE · SCORE WILL BE SENT LATER': 'SIN CONEXIÓN · TU PUNTAJE SE ENVIARÁ DESPUÉS',
  'SAVE YOUR PROGRESS · JOIN THE LEADERBOARDS': 'GUARDA TU PROGRESO · ENTRA A LOS RANKINGS',
  'Waiting for Google...': 'Esperando a Google...', 'Sign in with Google': 'Iniciar sesión con Google',
  'CANCEL': 'CANCELAR', 'CAN\'T REACH SERVER RIGHT NOW': 'NO HAY CONEXIÓN CON EL SERVIDOR',
  'SIGN-IN NOT AVAILABLE RIGHT NOW': 'INICIO DE SESIÓN NO DISPONIBLE POR AHORA',
  'OR JUST PLAY AS A GUEST': 'O JUEGA COMO INVITADO',
  'GUESTS KEEP PLAYING FULLY OFFLINE · NO PASSWORD EVER': 'LOS INVITADOS JUEGAN SIN CONEXIÓN · SIN CONTRASEÑAS',
  'LEADERBOARD': 'RANKING', 'ALL': 'TODO',
  'TOTAL · BEST OF EVERY STAGE': 'TOTAL · MEJOR DE CADA ETAPA', 'STAGE {n} · {name}': 'ETAPA {n} · {name}',
  'NO SCORES YET - BE FIRST!': 'AÚN NO HAY PUNTAJES. ¡SÉ EL PRIMERO!',
  'YOU: #{rank} OF {players} · {score}': 'TÚ: #{rank} DE {players} · {score}',
  'YOU: #{rank} OF {players} · {score}  (OUTSIDE TOP 20)': 'TÚ: #{rank} DE {players} · {score}  (FUERA DEL TOP 20)',
  'YOU HAVEN\'T SET A SCORE HERE YET': 'AÚN NO TIENES PUNTAJE AQUÍ',
  'GUEST · SIGN IN WITH GOOGLE (PROFILE) TO GET RANKED': 'INVITADO · INICIA SESIÓN CON GOOGLE (PERFIL) PARA ENTRAR AL RANKING',
  '◄ ► TAB · ESC BACK': '◄ ► PESTAÑA · ESC VOLVER', 'LOADING...': 'CARGANDO...',
  'RANK #{rank} · TOTAL {total}': 'RANGO #{rank} · TOTAL {total}', 'NOT RANKED YET': 'SIN RANGO AÚN',
  '{stars}/{max} STARS · {unlocked}/{stages} UNLOCKED': '{stars}/{max} ESTRELLAS · {unlocked}/{stages} DESBLOQUEADAS',
  'COLOUR': 'COLOR', 'CHANGE NAME': 'CAMBIAR NOMBRE', 'LOG OUT': 'SALIR', 'SAVE': 'GUARDAR',
  '3-16 LETTERS, NUMBERS, _ -': '3-16 LETRAS, NÚMEROS, _ -',

  /* toasts / messages / errors (api.js messages arrive in English and are uppercased) */
  'LINK COPIED! SEND IT TO A FRIEND': '¡ENLACE COPIADO! ENVÍASELO A UN AMIGO', 'COULDN\'T SHARE': 'NO SE PUDO COMPARTIR',
  'SLOW DOWN': 'MÁS DESPACIO', 'SLOW DOWN - TRY AGAIN IN A MOMENT': 'MÁS DESPACIO - INTENTA DE NUEVO EN UN MOMENTO',
  'WELCOME BACK, {name}!': '¡BIENVENIDO DE NUEVO, {name}!', 'WELCOME! PICK A NAME & COLOUR': '¡BIENVENIDO! ELIGE NOMBRE Y COLOR',
  'NAME CHANGED!': '¡NOMBRE CAMBIADO!', 'LOGGED OUT': 'SESIÓN CERRADA', 'COULD NOT SAVE COLOUR': 'NO SE PUDO GUARDAR EL COLOR',
  'NO SUCH PLAYER': 'JUGADOR NO ENCONTRADO', 'CAN\'T REACH SERVER': 'SIN CONEXIÓN CON EL SERVIDOR',
  'POPUP BLOCKED - ALLOW POPUPS & TRY AGAIN': 'VENTANA BLOQUEADA - PERMITE VENTANAS EMERGENTES E INTENTA DE NUEVO',
  'WAITING FOR GOOGLE...': 'ESPERANDO A GOOGLE...', 'CANCELLED - NO WORRIES, KEEP PLAYING': 'CANCELADO - SIN PROBLEMA, SIGUE JUGANDO',
  'CAN\'T REACH SERVER - PLAY AS GUEST': 'SIN CONEXIÓN - JUEGA COMO INVITADO',
  'NAME: 3-16 LETTERS, NUMBERS, _ -': 'NOMBRE: 3-16 LETRAS, NÚMEROS, _ -', 'ONE MOMENT...': 'UN MOMENTO...',
  'USERNAME TAKEN - TRY ANOTHER': 'NOMBRE EN USO - PRUEBA OTRO', 'USERNAME TAKEN': 'NOMBRE EN USO',
  'USERNAME: 3-16 LETTERS, NUMBERS, _ -': 'NOMBRE: 3-16 LETRAS, NÚMEROS, _ -',
  'SERVER UNREACHABLE': 'SERVIDOR SIN CONEXIÓN', 'NOT FOUND': 'NO ENCONTRADO', 'ERROR': 'ERROR',
  'SIGN-IN CANCELLED': 'INICIO DE SESIÓN CANCELADO', 'GOOGLE SAID NO - TRY AGAIN': 'GOOGLE LO RECHAZÓ - INTENTA DE NUEVO',
  'SIGN-IN COULD NOT BE VERIFIED - TRY AGAIN': 'NO SE PUDO VERIFICAR EL INICIO DE SESIÓN - INTENTA DE NUEVO',
  'GOOGLE SIGN-IN FAILED - TRY AGAIN': 'FALLÓ EL INICIO DE SESIÓN CON GOOGLE - INTENTA DE NUEVO',

  /* share text */
  'I scored {score} on {stage} in Claude Ware. Think you can beat me?': 'Hice {score} puntos en {stage} de Claude Ware. ¿Crees que puedes superarme?',
  'Claude Ware: 100+ five-second microgames. Come play!': 'Claude Ware: más de 100 microjuegos de cinco segundos. ¡Ven a jugar!',
  'CHALLENGE YOUR FRIENDS': 'RETA A TUS AMIGOS', 'COPY LINK': 'COPIAR ENLACE', 'CLOSE': 'CERRAR', 'X / TWITTER': 'X / TWITTER',
  'CAN YOU BEAT IT?': '¿PUEDES SUPERARLO?',
  'CAN YOU BEAT ME?': '¿PUEDES SUPERARME?', 'PLAY FREE': 'JUEGA GRATIS', 'SCORE': 'PUNTOS', 'NEW BEST!': '¡NUEVO RÉCORD!', 'GUEST': 'INVITADO',
});
