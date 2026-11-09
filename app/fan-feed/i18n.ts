"use client";
import type { Language } from "../../components/LanguageProvider";
const en = {
  "title": "Fan HQ",
  "signIn": "Sign in to connect with fans.",
  "fansOnly": "Fan accounts only",
  "membershipRequired": "Unlock Fan HoopFeed",
  "membershipDescription": "An active Pro or Premium membership is required to post and connect in Fan HoopFeed.",
  "kicker": "FAN HQ · CLUB COMMUNITIES",
  "teamPosts": "Fan posts for this team",
  "openFeed": "Open Fan HoopFeed",
  "viewFanProfile": "View fan profile",
  "separateSurface": "Fan HoopFeed is separate from player HoopFeed.",
  "playerFeed": "Player HoopFeed",
  "discoverFans": "Discover fans",
  "teams": "Teams",
  "subtitle": "Your clubs, your fan communities, all in one place.",
  "feedExplainer": "Posts from the fan groups of the clubs you follow.",
  "postPromptTitle": "Have something to share with your club's fans?",
  "postPromptBody": "Choose a club you follow. You can post after joining its Fan Group.",
  "searchFollowedTeams": "Search your followed clubs…",
  "followedTeams": "Your followed clubs",
  "noFollowedTeamsMatch": "No followed clubs match that search.",
  "chooseTeam": "Choose a followed club",
  "postingTo": "Posting to",
  "fans": "fans",
  "fanGroup": "FAN GROUP",
  "emptyClubTitle": "No posts yet — be the first to post for {team}.",
  "emptyClubBody": "This club's fan group is quiet right now. Start the conversation for {team}.",
  "beFirstToPost": "Be the first to post",
  "followClubs": "Follow clubs to see their fan-group posts",
  "cancel": "Cancel",
  "change": "Change",
  "joined": "Joined",
  "joinRequired": "Join to participate",
  "joinBeforePosting": "Join {team} Fan Group before posting.",
  "joinBeforeReading": "Join {team} Fan Group to see its posts.",
  "groupMembersOnly": "Club group posts and comments are visible only to approved group members.",
  "openJoinGroup": "Open Fan Group",
  "openGroup": "Open group",
  "pinned": "Pinned by a group moderator",
  "report": "Report",
  "reportPrompt": "Why are you reporting this group post?",
  "reportSent": "Report sent to the group moderators.",
  "reportFailed": "Could not send your report.",
  "teamFirst": "Your team. Your people.",
  "fanOnlyNote": "A separate fan-only feed · posts expire after 24 hours",
  "postForTeam": "POST FOR YOUR TEAM",
  "composerPlaceholder": "What’s happening with your team? (500 characters max)",
  "selectTeam": "Select a followed team",
  "addPhoto": "Add photo",
  "photoLimit": "Choose a JPG, PNG, or WebP photo up to 4 MB.",
  "photoPreview": "Photo preview",
  "removePhoto": "Remove photo",
  "posting": "Publishing…",
  "post": "Post",
  "moderating": "Checking your post for safety…",
  "published": "Your post is live.",
  "publishFailed": "Your post could not be published.",
  "commentFailed": "Your comment could not be published.",
  "following": "Following",
  "followFan": "Follow fan",
  "like": "Like",
  "comment": "Comment",
  "comments": "Comments",
  "commentPlaceholder": "Add a comment…",
  "send": "Send",
  "expires": "Expires",
  "postPhoto": "Fan post photo",
  "fan": "Fan",
  "loading": "Loading Fan HoopFeed…",
  "followTeamFirst": "Follow a team before posting.",
  "recentPosts": "Recent fan posts",
  "emptyKicker": "CLUB FAN GROUPS",
  "emptyTitle": "Follow clubs to build your Fan HQ.",
  "emptyBody": "Join the Fan Groups of clubs you follow. Their posts will appear here.",
  "teamHub": "Team Hub",
  "addVideo": "Add video",
  "share": "Share",
  "archive": "Archive",
  "delete": "Delete",
  "check": "Check",
  "checked": "Checked",
  "videoLimit": "Use MP4, WebM, or MOV up to 50 MB.",
  "deleteConfirm": "Delete this post permanently?",
  "archiveSuccess": "Post archived. Only you can see your archive action.",
  "deleteSuccess": "Post deleted.",
  "linkCopied": "Post link copied.",
  "shareFailed": "Could not share this post. Copy the page link and try again.",
  "shareTitle": "HoopCheck Fan HQ",
  "videoPostLabel": "Fan post video"
} as const;
const localized: Partial<Record<Language, Partial<Record<keyof typeof en,string>>>> = {
 es:{title:"Fan HQ",subtitle:"Tus clubes y sus comunidades de fans, en un solo lugar.",feedExplainer:"Publicaciones de los grupos de fans de los clubes que sigues.",postPromptTitle:"¿Tienes algo que compartir con los fans de tu club?",postPromptBody:"Elige un club que sigues. Podrás publicar después de unirte a su grupo de fans.",searchFollowedTeams:"Buscar clubes que sigues…",followedTeams:"Tus clubes seguidos",noFollowedTeamsMatch:"Ningún club seguido coincide con la búsqueda.",chooseTeam:"Elige un club que sigues",postingTo:"Publicando para",fans:"fans",fanGroup:"GRUPO DE FANS",emptyClubTitle:"Aún no hay publicaciones: sé el primero en publicar para {team}.",emptyClubBody:"El grupo de fans de {team} está tranquilo. Inicia la conversación.",beFirstToPost:"Sé el primero en publicar",followClubs:"Sigue clubes para ver sus publicaciones.",cancel:"Cancelar",change:"Cambiar",teamPosts:"Publicaciones de fans de este equipo",openFeed:"Abrir Fan HQ",membershipRequired:"Desbloquea Fan HQ",membershipDescription:"Se requiere una membresía Pro o Premium activa.",kicker:"FAN HQ · CLUB COMMUNITIES",viewFanProfile:"Ver perfil del fan",signIn:"Inicia sesión para conectar con otros fans.",discoverFans:"Descubrir fans",teams:"Equipos",post:"Publicar",joined:"Miembro",joinRequired:"Únete para participar",joinBeforePosting:"Únete al grupo de fans de {team} antes de publicar.",joinBeforeReading:"Únete al grupo de fans de {team} para ver sus publicaciones.",groupMembersOnly:"Las publicaciones y los comentarios solo son visibles para miembros aprobados.",openJoinGroup:"Abrir grupo de fans",openGroup:"Abrir grupo",pinned:"Fijado por un moderador",report:"Denunciar",reportPrompt:"¿Por qué denuncias esta publicación?",reportSent:"Denuncia enviada a los moderadores.",reportFailed:"No se pudo enviar la denuncia.",like:"Me gusta",comment:"Comentar",comments:"Comentarios",followFan:"Seguir fan",following:"Siguiendo",send:"Enviar",addPhoto:"Añadir foto",selectTeam:"Selecciona un equipo seguido",emptyTitle:"Sigue clubes para crear tu Fan HQ.",emptyBody:"Únete a los grupos de fans de los clubes que sigues. Sus publicaciones aparecerán aquí.",fanOnlyNote:"Feed exclusivo para fans · las publicaciones caducan en 24 horas",teamHub:"Centro de equipos",addVideo:"Añadir vídeo",share:"Compartir",archive:"Archivar",delete:"Eliminar",check:"Check",checked:"Marcado",videoLimit:"Usa MP4, WebM o MOV de hasta 50 MB.",deleteConfirm:"¿Eliminar esta publicación permanentemente?",archiveSuccess:"Publicación archivada. Solo tú puedes ver el archivo.",deleteSuccess:"Publicación eliminada.",linkCopied:"Enlace copiado.",shareFailed:"No se pudo compartir. Copia el enlace de la página e inténtalo de nuevo.",shareTitle:"HoopCheck Fan HQ",videoPostLabel:"Vídeo de publicación de fan"},
 fr:{title:"Fan HQ",subtitle:"Vos clubs et leurs communautés de supporters, au même endroit.",feedExplainer:"Publications des groupes de supporters des clubs que vous suivez.",postPromptTitle:"Quelque chose à partager avec les supporters de votre club ?",postPromptBody:"Choisissez un club que vous suivez. Votre publication apparaîtra dans son groupe de supporters.",searchFollowedTeams:"Rechercher parmi vos clubs suivis…",followedTeams:"Vos clubs suivis",noFollowedTeamsMatch:"Aucun club suivi ne correspond à cette recherche.",chooseTeam:"Choisir un club suivi",postingTo:"Publication pour",fans:"supporters",fanGroup:"GROUPE DE SUPPORTERS",emptyClubTitle:"Aucune publication — soyez le premier à publier pour {team}.",emptyClubBody:"Le groupe de supporters de {team} est calme. Lancez la conversation.",beFirstToPost:"Publier en premier",followClubs:"Suivez des clubs pour voir leurs publications.",cancel:"Annuler",change:"Modifier",teamPosts:"Publications des fans de cette équipe",openFeed:"Ouvrir le Fan HQ",membershipRequired:"Débloquer le Fan HQ",membershipDescription:"Un abonnement Pro ou Premium actif est requis.",kicker:"FAN HQ · CLUB COMMUNITIES",viewFanProfile:"Voir le profil du fan",signIn:"Connectez-vous pour échanger avec des fans.",discoverFans:"Découvrir des fans",teams:"Équipes",post:"Publier",joined:"Membre",joinRequired:"Rejoindre pour participer",joinBeforePosting:"Rejoignez le groupe de supporters de {team} avant de publier.",joinBeforeReading:"Rejoignez le groupe de supporters de {team} pour voir ses publications.",groupMembersOnly:"Les publications et commentaires sont réservés aux membres approuvés du groupe.",openJoinGroup:"Ouvrir le groupe",openGroup:"Ouvrir le groupe",pinned:"Épinglé par un modérateur",report:"Signaler",reportPrompt:"Pourquoi signalez-vous cette publication ?",reportSent:"Signalement envoyé aux modérateurs.",reportFailed:"Impossible d’envoyer le signalement.",like:"J’aime",comment:"Commenter",comments:"Commentaires",followFan:"Suivre ce fan",following:"Abonné",send:"Envoyer",addPhoto:"Ajouter une photo",selectTeam:"Choisir une équipe suivie",emptyTitle:"Votre fil de fans commence ici.",emptyBody:"Suivez des équipes et des fans pour voir leurs publications.",fanOnlyNote:"Fil réservé aux fans · expiration après 24 heures",teamHub:"Espace des équipes",addVideo:"Ajouter une vidéo",share:"Partager",archive:"Archiver",delete:"Supprimer",check:"Check",checked:"Validé",videoLimit:"Utilisez MP4, WebM ou MOV jusqu’à 50 Mo.",deleteConfirm:"Supprimer définitivement cette publication ?",archiveSuccess:"Publication archivée. Vous seul pouvez voir cette action.",deleteSuccess:"Publication supprimée.",linkCopied:"Lien copié.",shareFailed:"Impossible de partager. Copiez le lien de la page et réessayez.",shareTitle:"HoopCheck Fan HQ",videoPostLabel:"Vidéo de publication de fan"},
 de:{title:"Fan-HoopFeed",teamPosts:"Fan-Beiträge für dieses Team",openFeed:"Fan-HoopFeed öffnen",membershipRequired:"Fan-HoopFeed freischalten",membershipDescription:"Eine aktive Pro- oder Premium-Mitgliedschaft ist erforderlich.",kicker:"FAN HQ · CLUB COMMUNITIES",viewFanProfile:"Fanprofil ansehen",signIn:"Melde dich an, um dich mit Fans zu verbinden.",subtitle:"Vernetze dich mit Fans und poste für deine Lieblingsteams.",discoverFans:"Fans entdecken",teams:"Teams",post:"Veröffentlichen",like:"Gefällt mir",comment:"Kommentieren",comments:"Kommentare",followFan:"Fan folgen",following:"Du folgst",send:"Senden",addPhoto:"Foto hinzufügen",chooseTeam:"Wähle ein Team, dem du folgst",selectTeam:"Gefolgtes Team auswählen",emptyTitle:"Dein Fan-Feed beginnt hier.",emptyBody:"Folge Teams und Fans, um Team-Beiträge zu sehen.",fanOnlyNote:"Nur für Fans · Beiträge laufen nach 24 Stunden ab",teamHub:"Team-Hub",addVideo:"Video hinzufügen",share:"Teilen",archive:"Archivieren",delete:"Löschen",check:"Check",checked:"Abgehakt",videoLimit:"MP4, WebM oder MOV bis 50 MB verwenden.",deleteConfirm:"Diesen Beitrag endgültig löschen?",archiveSuccess:"Beitrag archiviert. Nur du siehst diese Archivaktion.",deleteSuccess:"Beitrag gelöscht.",linkCopied:"Beitragslink kopiert.",shareFailed:"Teilen nicht möglich. Kopiere den Seitenlink und versuche es erneut.",shareTitle:"HoopCheck Fan-HoopFeed",videoPostLabel:"Fan-Beitragsvideo"},
 az:{title:"Fan HoopFeed",teamPosts:"Bu komanda üçün fan paylaşımları",openFeed:"Fan HoopFeed-i aç",membershipRequired:"Fan HoopFeed-i aktivləşdirin",membershipDescription:"Aktiv Pro və ya Premium üzvlüyü tələb olunur.",kicker:"FAN HQ · CLUB COMMUNITIES",viewFanProfile:"Fan profilinə bax",signIn:"Fanlarla əlaqə üçün daxil olun.",subtitle:"Fanlarla əlaqə qurun və sevdiyiniz komandalar üçün paylaşım edin.",discoverFans:"Fanları kəşf et",teams:"Komandalar",post:"Paylaş",like:"Bəyən",comment:"Şərh yaz",comments:"Şərhlər",followFan:"Fanı izlə",following:"İzlənilir",send:"Göndər",addPhoto:"Şəkil əlavə et",chooseTeam:"İzlədiyiniz komandadan birini seçin",selectTeam:"İzlənilən komandanı seçin",emptyTitle:"Fan lentiniz burada başlayır.",emptyBody:"Komanda paylaşımlarını görmək üçün komandaları və fanları izləyin.",fanOnlyNote:"Yalnız fanlar üçün · paylaşımlar 24 saatdan sonra silinir",teamHub:"Komanda mərkəzi",addVideo:"Video əlavə et",share:"Paylaş",archive:"Arxivlə",delete:"Sil",check:"Check",checked:"Yoxlanıldı",videoLimit:"50 MB-a qədər MP4, WebM və ya MOV istifadə edin.",deleteConfirm:"Bu paylaşım həmişəlik silinsin?",archiveSuccess:"Paylaşım arxivləndi. Arxiv əməliyyatını yalnız siz görə bilərsiniz.",deleteSuccess:"Paylaşım silindi.",linkCopied:"Paylaşım linki köçürüldü.",shareFailed:"Paylaşmaq mümkün olmadı. Səhifə linkini köçürüb yenidən cəhd edin.",shareTitle:"HoopCheck Fan HQ",videoPostLabel:"Fan paylaşım videosu"}
};

const additional: Partial<Record<Language, Partial<Record<keyof typeof en,string>>>> = {
 tr:{title:"Fan HoopFeed",signIn:"Hayranlarla bağlantı kurmak için giriş yapın.",fansOnly:"Yalnızca hayran hesapları",membershipRequired:"Fan HoopFeed'in kilidini açın",membershipDescription:"Paylaşım yapmak ve bağlantı kurmak için aktif Pro veya Premium üyelik gerekir.",kicker:"HOOPFEED · FAN MERKEZİ",teamPosts:"Bu takım için hayran gönderileri",openFeed:"Fan HoopFeed'i aç",viewFanProfile:"Hayran profilini görüntüle",separateSurface:"Fan HoopFeed, oyuncu HoopFeed'inden ayrıdır.",playerFeed:"Oyuncu HoopFeed'i",discoverFans:"Hayranları keşfet",teams:"Takımlar",subtitle:"Hayranlarla bağlantı kurun ve desteklediğiniz takımlar için paylaşım yapın.",teamFirst:"Senin takımın. Senin topluluğun.",fanOnlyNote:"Yalnızca hayranlara özel akış · gönderiler 24 saat sonra sona erer",postForTeam:"TAKIMIN İÇİN PAYLAŞ",composerPlaceholder:"Takımında neler oluyor? (En fazla 500 karakter)",chooseTeam:"Takip ettiğin takımlardan birini seç",selectTeam:"Takip edilen bir takım seç",addPhoto:"Fotoğraf ekle",photoLimit:"8 MB'a kadar JPG, PNG veya WebP fotoğraf seçin.",photoPreview:"Fotoğraf önizlemesi",removePhoto:"Fotoğrafı kaldır",posting:"Yayınlanıyor…",post:"Fan HoopFeed'de paylaş",moderating:"Gönderiniz güvenlik açısından kontrol ediliyor…",published:"Gönderiniz yayınlandı.",publishFailed:"Gönderiniz yayınlanamadı.",commentFailed:"Yorumunuz yayınlanamadı.",following:"Takip ediliyor",followFan:"Hayranı takip et",like:"Beğen",comment:"Yorum yap",comments:"Yorumlar",commentPlaceholder:"Yorum ekle…",send:"Gönder",expires:"Sona erer",postPhoto:"Hayran gönderisi fotoğrafı",fan:"Hayran",loading:"Fan HoopFeed yükleniyor…",followTeamFirst:"Paylaşım yapmadan önce bir takımı takip edin.",recentPosts:"Son hayran gönderileri",emptyKicker:"HAYRAN TOPLULUĞU",emptyTitle:"Hayran akışınız burada başlıyor.",emptyBody:"Takım etiketli gönderileri ve sohbetleri görmek için takımları ve hayranları takip edin.",teamHub:"Takım Merkezi",addVideo:"Video ekle",share:"Paylaş",archive:"Arşivle",delete:"Sil",check:"Check",checked:"Check yapıldı",videoLimit:"50 MB'a kadar MP4, WebM veya MOV kullanın.",deleteConfirm:"Bu gönderi kalıcı olarak silinsin mi?",archiveSuccess:"Gönderi arşivlendi.",deleteSuccess:"Gönderi silindi.",linkCopied:"Gönderi bağlantısı kopyalandı.",shareFailed:"Gönderi paylaşılamadı. Sayfa bağlantısını kopyalayıp tekrar deneyin.",shareTitle:"HoopCheck Fan HQ",videoPostLabel:"Fan gönderi videosu"},
 pt:{title:"HoopFeed de fãs",signIn:"Entre para se conectar com outros fãs.",fansOnly:"Apenas contas de fãs",membershipRequired:"Desbloquear o HoopFeed de fãs",membershipDescription:"É necessária uma assinatura Pro ou Premium ativa para publicar e conectar-se.",kicker:"HOOPFEED · CENTRAL DOS FÃS",teamPosts:"Publicações de fãs para esta equipa",openFeed:"Abrir HoopFeed de fãs",viewFanProfile:"Ver perfil do fã",separateSurface:"O HoopFeed de fãs é separado do HoopFeed de jogadores.",playerFeed:"HoopFeed de jogadores",discoverFans:"Descobrir fãs",teams:"Equipas",subtitle:"Conecte-se com fãs e publique para as equipas que apoia.",teamFirst:"A sua equipa. A sua comunidade.",fanOnlyNote:"Feed exclusivo para fãs · publicações expiram após 24 horas",postForTeam:"PUBLICAR PELA SUA EQUIPA",composerPlaceholder:"O que se passa com a sua equipa? (máx. 500 caracteres)",chooseTeam:"Escolha uma equipa que segue",selectTeam:"Selecione uma equipa seguida",addPhoto:"Adicionar foto",photoLimit:"Escolha uma foto JPG, PNG ou WebP até 8 MB.",photoPreview:"Pré-visualização da foto",removePhoto:"Remover foto",posting:"A publicar…",post:"Publicar no HoopFeed de fãs",moderating:"A verificar a segurança da publicação…",published:"A sua publicação está ativa.",publishFailed:"Não foi possível publicar.",commentFailed:"Não foi possível publicar o comentário.",following:"A seguir",followFan:"Seguir fã",like:"Gosto",comment:"Comentar",comments:"Comentários",commentPlaceholder:"Adicionar comentário…",send:"Enviar",expires:"Expira",postPhoto:"Foto da publicação de fã",fan:"Fã",loading:"A carregar HoopFeed de fãs…",followTeamFirst:"Siga uma equipa antes de publicar.",recentPosts:"Publicações recentes de fãs",emptyKicker:"COMUNIDADE DE FÃS",emptyTitle:"O seu feed de fãs começa aqui.",emptyBody:"Siga equipas e fãs para ver publicações e conversas.",teamHub:"Centro das equipas",addVideo:"Adicionar vídeo",share:"Partilhar",archive:"Arquivar",delete:"Eliminar",check:"Check",checked:"Marcado",videoLimit:"Use MP4, WebM ou MOV até 50 MB.",deleteConfirm:"Eliminar esta publicação permanentemente?",archiveSuccess:"Publicação arquivada.",deleteSuccess:"Publicação eliminada.",linkCopied:"Ligação copiada.",shareFailed:"Não foi possível partilhar. Copie a ligação da página e tente novamente.",shareTitle:"HoopCheck HoopFeed de fãs",videoPostLabel:"Vídeo da publicação de fã"},
 it:{title:"HoopFeed dei fan",signIn:"Accedi per connetterti con altri fan.",fansOnly:"Solo account fan",membershipRequired:"Sblocca HoopFeed dei fan",membershipDescription:"È necessario un abbonamento Pro o Premium attivo per pubblicare e connettersi.",kicker:"FAN HQ · CLUB COMMUNITIES",teamPosts:"Post dei fan per questa squadra",openFeed:"Apri HoopFeed dei fan",viewFanProfile:"Visualizza profilo fan",separateSurface:"HoopFeed dei fan è separato da HoopFeed dei giocatori.",playerFeed:"HoopFeed giocatori",discoverFans:"Scopri i fan",teams:"Squadre",subtitle:"Connettiti con i fan e pubblica per le squadre che sostieni.",teamFirst:"La tua squadra. La tua community.",fanOnlyNote:"Feed solo fan · i post scadono dopo 24 ore",postForTeam:"PUBBLICA PER LA TUA SQUADRA",composerPlaceholder:"Cosa succede alla tua squadra? (max 500 caratteri)",chooseTeam:"Scegli una squadra che segui",selectTeam:"Seleziona una squadra seguita",addPhoto:"Aggiungi foto",photoLimit:"Scegli una foto JPG, PNG o WebP fino a 8 MB.",photoPreview:"Anteprima foto",removePhoto:"Rimuovi foto",posting:"Pubblicazione…",post:"Pubblica su HoopFeed fan",moderating:"Controllo di sicurezza del post…",published:"Il tuo post è online.",publishFailed:"Impossibile pubblicare il post.",commentFailed:"Impossibile pubblicare il commento.",following:"Segui già",followFan:"Segui fan",like:"Mi piace",comment:"Commenta",comments:"Commenti",commentPlaceholder:"Aggiungi un commento…",send:"Invia",expires:"Scade",postPhoto:"Foto del post fan",fan:"Fan",loading:"Caricamento HoopFeed fan…",followTeamFirst:"Segui una squadra prima di pubblicare.",recentPosts:"Post recenti dei fan",emptyKicker:"COMMUNITY FAN",emptyTitle:"Il tuo feed fan inizia qui.",emptyBody:"Segui squadre e fan per vedere post e conversazioni.",teamHub:"Hub squadre",addVideo:"Aggiungi video",share:"Condividi",archive:"Archivia",delete:"Elimina",check:"Check",checked:"Verificato",videoLimit:"Usa MP4, WebM o MOV fino a 50 MB.",deleteConfirm:"Eliminare definitivamente questo post?",archiveSuccess:"Post archiviato.",deleteSuccess:"Post eliminato.",linkCopied:"Link copiato.",shareFailed:"Impossibile condividere. Copia il link della pagina e riprova.",shareTitle:"HoopCheck HoopFeed fan",videoPostLabel:"Video del post fan"},
 ru:{title:"Fan HoopFeed",signIn:"Войдите, чтобы общаться с фанатами.",fansOnly:"Только аккаунты фанатов",membershipRequired:"Откройте Fan HoopFeed",membershipDescription:"Для публикаций и общения требуется активная подписка Pro или Premium.",kicker:"HOOPFEED · ФАН-ЦЕНТР",teamPosts:"Публикации фанатов этой команды",openFeed:"Открыть Fan HoopFeed",viewFanProfile:"Посмотреть профиль фаната",separateSurface:"Fan HoopFeed отделён от HoopFeed игроков.",playerFeed:"HoopFeed игроков",discoverFans:"Найти фанатов",teams:"Команды",subtitle:"Общайтесь с фанатами и публикуйте материалы о любимых командах.",teamFirst:"Твоя команда. Твоё сообщество.",fanOnlyNote:"Лента только для фанатов · публикации исчезают через 24 часа",postForTeam:"ПУБЛИКАЦИЯ О КОМАНДЕ",composerPlaceholder:"Что нового у вашей команды? (до 500 символов)",chooseTeam:"Выберите команду, на которую подписаны",selectTeam:"Выберите команду",addPhoto:"Добавить фото",photoLimit:"Выберите JPG, PNG или WebP до 8 МБ.",photoPreview:"Предпросмотр фото",removePhoto:"Удалить фото",posting:"Публикация…",post:"Опубликовать",moderating:"Проверяем публикацию на безопасность…",published:"Публикация размещена.",publishFailed:"Не удалось опубликовать запись.",commentFailed:"Не удалось опубликовать комментарий.",following:"Вы подписаны",followFan:"Подписаться на фаната",like:"Нравится",comment:"Комментировать",comments:"Комментарии",commentPlaceholder:"Добавить комментарий…",send:"Отправить",expires:"Истекает",postPhoto:"Фото публикации фаната",fan:"Фанат",loading:"Загрузка Fan HoopFeed…",followTeamFirst:"Сначала подпишитесь на команду.",recentPosts:"Последние публикации фанатов",emptyKicker:"СООБЩЕСТВО ФАНАТОВ",emptyTitle:"Ваша лента фанатов начинается здесь.",emptyBody:"Подписывайтесь на команды и фанатов, чтобы видеть публикации.",teamHub:"Центр команды",addVideo:"Добавить видео",share:"Поделиться",archive:"В архив",delete:"Удалить",check:"Check",checked:"Отмечено",videoLimit:"MP4, WebM или MOV до 50 МБ.",deleteConfirm:"Удалить эту публикацию навсегда?",archiveSuccess:"Публикация архивирована.",deleteSuccess:"Публикация удалена.",linkCopied:"Ссылка скопирована.",shareFailed:"Не удалось поделиться. Скопируйте ссылку страницы и попробуйте снова.",shareTitle:"HoopCheck Fan HQ",videoPostLabel:"Видео публикации фаната"},
 pl:{title:"Fan HoopFeed",signIn:"Zaloguj się, aby połączyć się z fanami.",fansOnly:"Tylko konta fanów",membershipRequired:"Odblokuj Fan HoopFeed",membershipDescription:"Do publikowania i nawiązywania kontaktów wymagane jest aktywne członkostwo Pro lub Premium.",kicker:"HOOPFEED · STREFA FANÓW",teamPosts:"Posty fanów o tej drużynie",openFeed:"Otwórz Fan HoopFeed",viewFanProfile:"Zobacz profil fana",separateSurface:"Fan HoopFeed jest oddzielny od HoopFeed zawodników.",playerFeed:"HoopFeed zawodników",discoverFans:"Odkrywaj fanów",teams:"Drużyny",subtitle:"Nawiązuj kontakty z fanami i publikuj o wspieranych drużynach.",teamFirst:"Twoja drużyna. Twoja społeczność.",fanOnlyNote:"Kanał tylko dla fanów · posty wygasają po 24 godzinach",postForTeam:"OPUBLIKUJ DLA DRUŻYNY",composerPlaceholder:"Co słychać w Twojej drużynie? (maks. 500 znaków)",chooseTeam:"Wybierz obserwowaną drużynę",selectTeam:"Wybierz obserwowaną drużynę",addPhoto:"Dodaj zdjęcie",photoLimit:"Wybierz zdjęcie JPG, PNG lub WebP do 8 MB.",photoPreview:"Podgląd zdjęcia",removePhoto:"Usuń zdjęcie",posting:"Publikowanie…",post:"Opublikuj w Fan HoopFeed",moderating:"Sprawdzamy bezpieczeństwo posta…",published:"Post jest opublikowany.",publishFailed:"Nie udało się opublikować posta.",commentFailed:"Nie udało się opublikować komentarza.",following:"Obserwujesz",followFan:"Obserwuj fana",like:"Lubię to",comment:"Skomentuj",comments:"Komentarze",commentPlaceholder:"Dodaj komentarz…",send:"Wyślij",expires:"Wygasa",postPhoto:"Zdjęcie posta fana",fan:"Fan",loading:"Ładowanie Fan HoopFeed…",followTeamFirst:"Najpierw zacznij obserwować drużynę.",recentPosts:"Najnowsze posty fanów",emptyKicker:"SPOŁECZNOŚĆ FANÓW",emptyTitle:"Twój kanał fanów zaczyna się tutaj.",emptyBody:"Obserwuj drużyny i fanów, aby widzieć posty i rozmowy.",teamHub:"Centrum drużyny",addVideo:"Dodaj wideo",share:"Udostępnij",archive:"Archiwizuj",delete:"Usuń",check:"Check",checked:"Zaznaczono",videoLimit:"Użyj MP4, WebM lub MOV do 50 MB.",deleteConfirm:"Trwale usunąć ten post?",archiveSuccess:"Post zarchiwizowano.",deleteSuccess:"Post usunięto.",linkCopied:"Skopiowano link.",shareFailed:"Nie można udostępnić. Skopiuj link strony i spróbuj ponownie.",shareTitle:"HoopCheck Fan HQ",videoPostLabel:"Wideo posta fana"},
 zh:{title:"粉丝 HoopFeed",signIn:"登录以与其他粉丝交流。",fansOnly:"仅限粉丝账号",membershipRequired:"解锁粉丝 HoopFeed",membershipDescription:"发布内容和建立联系需要有效的 Pro 或 Premium 会员资格。",kicker:"HOOPFEED · 粉丝中心",teamPosts:"这支球队的粉丝帖子",openFeed:"打开粉丝 HoopFeed",viewFanProfile:"查看粉丝资料",separateSurface:"粉丝 HoopFeed 与球员 HoopFeed 分开。",playerFeed:"球员 HoopFeed",discoverFans:"发现粉丝",teams:"球队",subtitle:"与粉丝交流，并为你支持的球队发布内容。",teamFirst:"你的球队，你的社区。",fanOnlyNote:"仅粉丝可见 · 帖子将在 24 小时后过期",postForTeam:"为你的球队发帖",composerPlaceholder:"你的球队有什么新动态？（最多 500 字）",chooseTeam:"选择你关注的球队",selectTeam:"选择已关注的球队",addPhoto:"添加照片",photoLimit:"请选择 8 MB 以内的 JPG、PNG 或 WebP 图片。",photoPreview:"照片预览",removePhoto:"移除照片",posting:"正在发布…",post:"发布到粉丝 HoopFeed",moderating:"正在进行安全检查…",published:"帖子已发布。",publishFailed:"帖子发布失败。",commentFailed:"评论发布失败。",following:"已关注",followFan:"关注粉丝",like:"赞",comment:"评论",comments:"评论",commentPlaceholder:"添加评论…",send:"发送",expires:"过期时间",postPhoto:"粉丝帖子照片",fan:"粉丝",loading:"正在加载粉丝 HoopFeed…",followTeamFirst:"请先关注一支球队再发帖。",recentPosts:"最新粉丝帖子",emptyKicker:"粉丝社区",emptyTitle:"你的粉丝动态从这里开始。",emptyBody:"关注球队和粉丝即可查看球队帖子和讨论。",teamHub:"球队中心",addVideo:"添加视频",share:"分享",archive:"归档",delete:"删除",check:"Check",checked:"已 Check",videoLimit:"使用不超过 50 MB 的 MP4、WebM 或 MOV。",deleteConfirm:"永久删除此帖子？",archiveSuccess:"帖子已归档。",deleteSuccess:"帖子已删除。",linkCopied:"帖子链接已复制。",shareFailed:"分享失败。请复制页面链接后重试。",shareTitle:"HoopCheck 粉丝 HoopFeed",videoPostLabel:"粉丝帖子视频"},
 ja:{title:"ファン HoopFeed",signIn:"ファンとつながるにはログインしてください。",fansOnly:"ファンアカウント限定",membershipRequired:"ファン HoopFeed を利用する",membershipDescription:"投稿や交流には有効な Pro または Premium 会員資格が必要です。",kicker:"HOOPFEED · ファン HQ",teamPosts:"このチームのファン投稿",openFeed:"ファン HoopFeed を開く",viewFanProfile:"ファンプロフィールを見る",separateSurface:"ファン HoopFeed は選手用 HoopFeed とは別です。",playerFeed:"選手 HoopFeed",discoverFans:"ファンを探す",teams:"チーム",subtitle:"ファンと交流し、応援するチームについて投稿しましょう。",teamFirst:"あなたのチーム。あなたのコミュニティ。",fanOnlyNote:"ファン専用フィード · 投稿は24時間で期限切れ",postForTeam:"チームについて投稿",composerPlaceholder:"チームの近況は？（最大500文字）",chooseTeam:"フォロー中のチームを選択",selectTeam:"フォロー中のチームを選択",addPhoto:"写真を追加",photoLimit:"8 MB以下のJPG、PNG、WebP画像を選択してください。",photoPreview:"写真プレビュー",removePhoto:"写真を削除",posting:"投稿中…",post:"ファン HoopFeed に投稿",moderating:"安全性を確認しています…",published:"投稿しました。",publishFailed:"投稿できませんでした。",commentFailed:"コメントを投稿できませんでした。",following:"フォロー中",followFan:"ファンをフォロー",like:"いいね",comment:"コメント",comments:"コメント",commentPlaceholder:"コメントを追加…",send:"送信",expires:"期限",postPhoto:"ファン投稿の写真",fan:"ファン",loading:"ファン HoopFeed を読み込み中…",followTeamFirst:"投稿する前にチームをフォローしてください。",recentPosts:"最近のファン投稿",emptyKicker:"ファンコミュニティ",emptyTitle:"ファンフィードはここから始まります。",emptyBody:"チームやファンをフォローすると投稿や会話が表示されます。",teamHub:"チームハブ",addVideo:"動画を追加",share:"共有",archive:"アーカイブ",delete:"削除",check:"Check",checked:"チェック済み",videoLimit:"50 MB以下のMP4、WebM、MOVを使用してください。",deleteConfirm:"この投稿を完全に削除しますか？",archiveSuccess:"投稿をアーカイブしました。",deleteSuccess:"投稿を削除しました。",linkCopied:"投稿リンクをコピーしました。",shareFailed:"共有できませんでした。ページリンクをコピーして再試行してください。",shareTitle:"HoopCheck ファン HoopFeed",videoPostLabel:"ファン投稿動画"},
 fi:{title:"Fan HoopFeed",signIn:"Kirjaudu sisään yhdistääksesi faneihin.",fansOnly:"Vain fanitilit",membershipRequired:"Avaa Fan HoopFeed",membershipDescription:"Julkaisemiseen ja yhteydenpitoon tarvitaan aktiivinen Pro- tai Premium-jäsenyys.",kicker:"HOOPFEED · FANIKESKUS",teamPosts:"Fanien julkaisut tästä joukkueesta",openFeed:"Avaa Fan HoopFeed",viewFanProfile:"Näytä fanin profiili",separateSurface:"Fan HoopFeed on erillinen pelaajien HoopFeedistä.",playerFeed:"Pelaajien HoopFeed",discoverFans:"Etsi faneja",teams:"Joukkueet",subtitle:"Pidä yhteyttä faneihin ja julkaise tukemistasi joukkueista.",teamFirst:"Sinun joukkueesi. Sinun yhteisösi.",fanOnlyNote:"Vain faneille · julkaisut vanhenevat 24 tunnissa",postForTeam:"JULKAISE JOUKKUEESTASI",composerPlaceholder:"Mitä joukkueellesi kuuluu? (enintään 500 merkkiä)",chooseTeam:"Valitse seuraamasi joukkue",selectTeam:"Valitse seurattu joukkue",addPhoto:"Lisää kuva",photoLimit:"Valitse enintään 8 Mt:n JPG-, PNG- tai WebP-kuva.",photoPreview:"Kuvan esikatselu",removePhoto:"Poista kuva",posting:"Julkaistaan…",post:"Julkaise Fan HoopFeediin",moderating:"Tarkistetaan julkaisun turvallisuutta…",published:"Julkaisusi on julkaistu.",publishFailed:"Julkaisua ei voitu julkaista.",commentFailed:"Kommenttia ei voitu julkaista.",following:"Seurataan",followFan:"Seuraa fania",like:"Tykkää",comment:"Kommentoi",comments:"Kommentit",commentPlaceholder:"Lisää kommentti…",send:"Lähetä",expires:"Vanhenee",postPhoto:"Fanin julkaisun kuva",fan:"Fani",loading:"Ladataan Fan HoopFeediä…",followTeamFirst:"Seuraa ensin joukkuetta ennen julkaisua.",recentPosts:"Viimeisimmät fanijulkaisut",emptyKicker:"FANIYHTEISÖ",emptyTitle:"Fanisyötteesi alkaa tästä.",emptyBody:"Seuraa joukkueita ja faneja nähdäksesi julkaisut ja keskustelut.",teamHub:"Joukkueen keskus",addVideo:"Lisää video",share:"Jaa",archive:"Arkistoi",delete:"Poista",check:"Check",checked:"Merkitty",videoLimit:"Käytä enintään 50 Mt:n MP4-, WebM- tai MOV-tiedostoa.",deleteConfirm:"Poistetaanko julkaisu pysyvästi?",archiveSuccess:"Julkaisu arkistoitu.",deleteSuccess:"Julkaisu poistettu.",linkCopied:"Julkaisun linkki kopioitu.",shareFailed:"Jakaminen epäonnistui. Kopioi sivun linkki ja yritä uudelleen.",shareTitle:"HoopCheck Fan HQ",videoPostLabel:"Fanin julkaisuvideo"},
 he:{title:"HoopFeed לאוהדים",signIn:"התחברו כדי ליצור קשר עם אוהדים.",fansOnly:"חשבונות אוהדים בלבד",membershipRequired:"פתיחת HoopFeed לאוהדים",membershipDescription:"נדרש מנוי Pro או Premium פעיל כדי לפרסם ולהתחבר.",kicker:"HOOPFEED · מרכז האוהדים",teamPosts:"פוסטים של אוהדים על הקבוצה",openFeed:"פתיחת HoopFeed לאוהדים",viewFanProfile:"צפייה בפרופיל האוהד",separateSurface:"HoopFeed לאוהדים נפרד מ-HoopFeed לשחקנים.",playerFeed:"HoopFeed לשחקנים",discoverFans:"גילוי אוהדים",teams:"קבוצות",subtitle:"התחברו לאוהדים ופרסמו על הקבוצות שאתם תומכים בהן.",teamFirst:"הקבוצה שלך. הקהילה שלך.",fanOnlyNote:"פיד לאוהדים בלבד · הפוסטים פגים לאחר 24 שעות",postForTeam:"פרסום עבור הקבוצה",composerPlaceholder:"מה חדש בקבוצה שלך? (עד 500 תווים)",chooseTeam:"בחרו קבוצה שאתם עוקבים אחריה",selectTeam:"בחירת קבוצה במעקב",addPhoto:"הוספת תמונה",photoLimit:"בחרו תמונת JPG, PNG או WebP עד 8 MB.",photoPreview:"תצוגה מקדימה",removePhoto:"הסרת תמונה",posting:"מפרסם…",post:"פרסום ב-HoopFeed לאוהדים",moderating:"בדיקת בטיחות לפוסט…",published:"הפוסט פורסם.",publishFailed:"לא ניתן לפרסם את הפוסט.",commentFailed:"לא ניתן לפרסם את התגובה.",following:"במעקב",followFan:"מעקב אחר אוהד",like:"אהבתי",comment:"תגובה",comments:"תגובות",commentPlaceholder:"הוספת תגובה…",send:"שליחה",expires:"תוקף",postPhoto:"תמונת פוסט של אוהד",fan:"אוהד",loading:"טוען HoopFeed לאוהדים…",followTeamFirst:"עקבו אחר קבוצה לפני הפרסום.",recentPosts:"פוסטים אחרונים של אוהדים",emptyKicker:"קהילת אוהדים",emptyTitle:"פיד האוהדים מתחיל כאן.",emptyBody:"עקבו אחר קבוצות ואוהדים כדי לראות פוסטים ושיחות.",teamHub:"מרכז הקבוצה",addVideo:"הוספת וידאו",share:"שיתוף",archive:"ארכיון",delete:"מחיקה",check:"Check",checked:"סומן",videoLimit:"השתמשו ב-MP4, WebM או MOV עד 50 MB.",deleteConfirm:"למחוק את הפוסט לצמיתות?",archiveSuccess:"הפוסט הועבר לארכיון.",deleteSuccess:"הפוסט נמחק.",linkCopied:"קישור הפוסט הועתק.",shareFailed:"השיתוף נכשל. העתיקו את קישור הדף ונסו שוב.",shareTitle:"HoopCheck HoopFeed לאוהדים",videoPostLabel:"סרטון פוסט של אוהד"},
 lt:{title:"Fanų HoopFeed",signIn:"Prisijunkite, kad bendrautumėte su fanais.",fansOnly:"Tik fanų paskyros",membershipRequired:"Atrakinkite fanų HoopFeed",membershipDescription:"Norint skelbti ir bendrauti būtina aktyvi Pro arba Premium narystė.",kicker:"HOOPFEED · FANŲ CENTRAS",teamPosts:"Fanų įrašai apie šią komandą",openFeed:"Atidaryti fanų HoopFeed",viewFanProfile:"Peržiūrėti fano profilį",separateSurface:"Fanų HoopFeed atskirtas nuo žaidėjų HoopFeed.",playerFeed:"Žaidėjų HoopFeed",discoverFans:"Atrasti fanus",teams:"Komandos",subtitle:"Bendraukite su fanais ir skelbkite apie palaikomas komandas.",teamFirst:"Tavo komanda. Tavo bendruomenė.",fanOnlyNote:"Tik fanams · įrašai nustoja galioti po 24 valandų",postForTeam:"SKELBTI APIE KOMANDĄ",composerPlaceholder:"Kas naujo jūsų komandoje? (iki 500 simbolių)",chooseTeam:"Pasirinkite stebimą komandą",selectTeam:"Pasirinkite stebimą komandą",addPhoto:"Pridėti nuotrauką",photoLimit:"Pasirinkite JPG, PNG arba WebP nuotrauką iki 8 MB.",photoPreview:"Nuotraukos peržiūra",removePhoto:"Pašalinti nuotrauką",posting:"Skelbiama…",post:"Skelbti fanų HoopFeed",moderating:"Tikrinamas įrašo saugumas…",published:"Įrašas paskelbtas.",publishFailed:"Nepavyko paskelbti įrašo.",commentFailed:"Nepavyko paskelbti komentaro.",following:"Stebima",followFan:"Stebėti faną",like:"Patinka",comment:"Komentuoti",comments:"Komentarai",commentPlaceholder:"Pridėti komentarą…",send:"Siųsti",expires:"Galioja iki",postPhoto:"Fano įrašo nuotrauka",fan:"Fanas",loading:"Įkeliamas fanų HoopFeed…",followTeamFirst:"Prieš skelbdami pirmiausia sekite komandą.",recentPosts:"Naujausi fanų įrašai",emptyKicker:"FANŲ BENDRUOMENĖ",emptyTitle:"Jūsų fanų srautas prasideda čia.",emptyBody:"Sekite komandas ir fanus, kad matytumėte įrašus ir pokalbius.",teamHub:"Komandos centras",addVideo:"Pridėti vaizdo įrašą",share:"Bendrinti",archive:"Archyvuoti",delete:"Ištrinti",check:"Check",checked:"Pažymėta",videoLimit:"Naudokite MP4, WebM arba MOV iki 50 MB.",deleteConfirm:"Visam laikui ištrinti šį įrašą?",archiveSuccess:"Įrašas archyvuotas.",deleteSuccess:"Įrašas ištrintas.",linkCopied:"Įrašo nuoroda nukopijuota.",shareFailed:"Nepavyko bendrinti. Nukopijuokite puslapio nuorodą ir bandykite dar kartą.",shareTitle:"HoopCheck fanų HoopFeed",videoPostLabel:"Fano įrašo vaizdo įrašas"},
 uk:{title:"Fan HoopFeed",signIn:"Увійдіть, щоб спілкуватися з фанатами.",fansOnly:"Лише акаунти фанатів",membershipRequired:"Відкрийте Fan HoopFeed",membershipDescription:"Для публікацій і спілкування потрібна активна підписка Pro або Premium.",kicker:"HOOPFEED · ЦЕНТР ФАНАТІВ",teamPosts:"Публікації фанатів про цю команду",openFeed:"Відкрити Fan HoopFeed",viewFanProfile:"Переглянути профіль фаната",separateSurface:"Fan HoopFeed відокремлений від HoopFeed гравців.",playerFeed:"HoopFeed гравців",discoverFans:"Знайти фанатів",teams:"Команди",subtitle:"Спілкуйтеся з фанатами та публікуйте про команди, які підтримуєте.",teamFirst:"Твоя команда. Твоя спільнота.",fanOnlyNote:"Стрічка лише для фанатів · дописи зникають через 24 години",postForTeam:"ДОПИС ПРО КОМАНДУ",composerPlaceholder:"Що нового у вашої команди? (до 500 символів)",chooseTeam:"Виберіть команду, на яку підписані",selectTeam:"Виберіть команду",addPhoto:"Додати фото",photoLimit:"Виберіть JPG, PNG або WebP до 8 МБ.",photoPreview:"Попередній перегляд фото",removePhoto:"Видалити фото",posting:"Публікація…",post:"Опублікувати у Fan HoopFeed",moderating:"Перевіряємо допис на безпеку…",published:"Допис опубліковано.",publishFailed:"Не вдалося опублікувати допис.",commentFailed:"Не вдалося опублікувати коментар.",following:"Ви підписані",followFan:"Підписатися на фаната",like:"Подобається",comment:"Коментувати",comments:"Коментарі",commentPlaceholder:"Додати коментар…",send:"Надіслати",expires:"Спливає",postPhoto:"Фото допису фаната",fan:"Фанат",loading:"Завантаження Fan HoopFeed…",followTeamFirst:"Спочатку підпишіться на команду.",recentPosts:"Останні дописи фанатів",emptyKicker:"СПІЛЬНОТА ФАНАТІВ",emptyTitle:"Ваша фан-стрічка починається тут.",emptyBody:"Підписуйтеся на команди й фанатів, щоб бачити дописи та розмови.",teamHub:"Центр команди",addVideo:"Додати відео",share:"Поділитися",archive:"Архівувати",delete:"Видалити",check:"Check",checked:"Позначено",videoLimit:"Використовуйте MP4, WebM або MOV до 50 МБ.",deleteConfirm:"Видалити цей допис назавжди?",archiveSuccess:"Допис заархівовано.",deleteSuccess:"Допис видалено.",linkCopied:"Посилання скопійовано.",shareFailed:"Не вдалося поділитися. Скопіюйте посилання сторінки та спробуйте ще раз.",shareTitle:"HoopCheck Fan HQ",videoPostLabel:"Відео допису фаната"},
 sr:{title:"Fan HoopFeed",signIn:"Prijavite se da biste se povezali sa navijačima.",fansOnly:"Samo nalozi navijača",membershipRequired:"Otključajte Fan HoopFeed",membershipDescription:"Za objavljivanje i povezivanje potrebno je aktivno Pro ili Premium članstvo.",kicker:"HOOPFEED · CENTAR NAVIJAČA",teamPosts:"Objave navijača za ovaj tim",openFeed:"Otvori Fan HoopFeed",viewFanProfile:"Pogledaj profil navijača",separateSurface:"Fan HoopFeed je odvojen od HoopFeed-a igrača.",playerFeed:"HoopFeed igrača",discoverFans:"Otkrij navijače",teams:"Timovi",subtitle:"Povežite se sa navijačima i objavljujte o timovima koje podržavate.",teamFirst:"Tvoj tim. Tvoja zajednica.",fanOnlyNote:"Samo za navijače · objave ističu nakon 24 sata",postForTeam:"OBJAVI ZA SVOJ TIM",composerPlaceholder:"Šta se dešava sa tvojim timom? (do 500 znakova)",chooseTeam:"Izaberite tim koji pratite",selectTeam:"Izaberite praćeni tim",addPhoto:"Dodaj fotografiju",photoLimit:"Izaberite JPG, PNG ili WebP fotografiju do 8 MB.",photoPreview:"Pregled fotografije",removePhoto:"Ukloni fotografiju",posting:"Objavljivanje…",post:"Objavi na Fan HoopFeed",moderating:"Proverava se bezbednost objave…",published:"Objava je objavljena.",publishFailed:"Objava nije mogla biti objavljena.",commentFailed:"Komentar nije mogao biti objavljen.",following:"Pratite",followFan:"Prati navijača",like:"Sviđa mi se",comment:"Komentariši",comments:"Komentari",commentPlaceholder:"Dodaj komentar…",send:"Pošalji",expires:"Ističe",postPhoto:"Fotografija objave navijača",fan:"Navijač",loading:"Učitavanje Fan HoopFeed-a…",followTeamFirst:"Prvo zapratite tim pre objavljivanja.",recentPosts:"Nedavne objave navijača",emptyKicker:"ZAJEDNICA NAVIJAČA",emptyTitle:"Tvoj feed navijača počinje ovde.",emptyBody:"Pratite timove i navijače da biste videli objave i razgovore.",teamHub:"Centar tima",addVideo:"Dodaj video",share:"Podeli",archive:"Arhiviraj",delete:"Obriši",check:"Check",checked:"Označeno",videoLimit:"Koristite MP4, WebM ili MOV do 50 MB.",deleteConfirm:"Trajno obrisati ovu objavu?",archiveSuccess:"Objava je arhivirana.",deleteSuccess:"Objava je obrisana.",linkCopied:"Veza je kopirana.",shareFailed:"Deljenje nije uspelo. Kopirajte vezu stranice i pokušajte ponovo.",shareTitle:"HoopCheck Fan HQ",videoPostLabel:"Video objave navijača"},
 el:{title:"Fan HoopFeed",signIn:"Συνδεθείτε για να επικοινωνήσετε με φιλάθλους.",fansOnly:"Μόνο λογαριασμοί φιλάθλων",membershipRequired:"Ξεκλειδώστε το Fan HoopFeed",membershipDescription:"Απαιτείται ενεργή συνδρομή Pro ή Premium.",kicker:"HOOPFEED · ΚΕΝΤΡΟ ΦΙΛΑΘΛΩΝ",teamPosts:"Δημοσιεύσεις φιλάθλων για αυτή την ομάδα",openFeed:"Άνοιγμα Fan HoopFeed",viewFanProfile:"Προβολή προφίλ φιλάθλου",separateSurface:"Το Fan HoopFeed είναι ξεχωριστό από το HoopFeed παικτών.",playerFeed:"HoopFeed παικτών",discoverFans:"Ανακάλυψη φιλάθλων",teams:"Ομάδες",subtitle:"Συνδεθείτε με φιλάθλους και δημοσιεύστε για τις ομάδες που υποστηρίζετε.",teamFirst:"Η ομάδα σου. Η κοινότητά σου.",fanOnlyNote:"Ροή μόνο για φιλάθλους · οι δημοσιεύσεις λήγουν σε 24 ώρες",postForTeam:"ΔΗΜΟΣΙΕΥΣΗ ΓΙΑ ΤΗΝ ΟΜΑΔΑ",composerPlaceholder:"Τι νέο υπάρχει στην ομάδα σας; (έως 500 χαρακτήρες)",chooseTeam:"Επιλέξτε ομάδα που ακολουθείτε",selectTeam:"Επιλέξτε ομάδα",addPhoto:"Προσθήκη φωτογραφίας",photoLimit:"Επιλέξτε JPG, PNG ή WebP έως 8 MB.",photoPreview:"Προεπισκόπηση φωτογραφίας",removePhoto:"Αφαίρεση φωτογραφίας",posting:"Δημοσίευση…",post:"Δημοσίευση στο Fan HoopFeed",moderating:"Έλεγχος ασφάλειας δημοσίευσης…",published:"Η δημοσίευσή σας είναι ενεργή.",publishFailed:"Δεν ήταν δυνατή η δημοσίευση.",commentFailed:"Δεν ήταν δυνατή η δημοσίευση σχολίου.",following:"Ακολουθείτε",followFan:"Ακολουθήστε φίλαθλο",like:"Μου αρέσει",comment:"Σχόλιο",comments:"Σχόλια",commentPlaceholder:"Προσθήκη σχολίου…",send:"Αποστολή",expires:"Λήγει",postPhoto:"Φωτογραφία ανάρτησης φιλάθλου",fan:"Φίλαθλος",loading:"Φόρτωση Fan HoopFeed…",followTeamFirst:"Ακολουθήστε πρώτα μια ομάδα.",recentPosts:"Πρόσφατες δημοσιεύσεις φιλάθλων",emptyKicker:"ΚΟΙΝΟΤΗΤΑ ΦΙΛΑΘΛΩΝ",emptyTitle:"Η ροή σας ξεκινά εδώ.",emptyBody:"Ακολουθήστε ομάδες και φιλάθλους για να βλέπετε δημοσιεύσεις.",teamHub:"Κέντρο ομάδας",addVideo:"Προσθήκη βίντεο",share:"Κοινοποίηση",archive:"Αρχειοθέτηση",delete:"Διαγραφή",check:"Check",checked:"Επισημάνθηκε",videoLimit:"Χρησιμοποιήστε MP4, WebM ή MOV έως 50 MB.",deleteConfirm:"Να διαγραφεί οριστικά αυτή η δημοσίευση;",archiveSuccess:"Η δημοσίευση αρχειοθετήθηκε.",deleteSuccess:"Η δημοσίευση διαγράφηκε.",linkCopied:"Ο σύνδεσμος αντιγράφηκε.",shareFailed:"Δεν ήταν δυνατή η κοινοποίηση. Αντιγράψτε τον σύνδεσμο και δοκιμάστε ξανά.",shareTitle:"HoopCheck Fan HQ",videoPostLabel:"Βίντεο ανάρτησης φιλάθλου"},
 ar:{title:"Fan HoopFeed",signIn:"سجّل الدخول للتواصل مع المشجعين.",fansOnly:"حسابات المشجعين فقط",membershipRequired:"افتح Fan HoopFeed",membershipDescription:"يلزم اشتراك Pro أو Premium نشط للنشر والتواصل.",kicker:"HOOPFEED · مركز المشجعين",teamPosts:"منشورات المشجعين عن هذا الفريق",openFeed:"فتح Fan HoopFeed",viewFanProfile:"عرض ملف المشجع",separateSurface:"يعمل Fan HoopFeed بشكل منفصل عن HoopFeed اللاعبين.",playerFeed:"HoopFeed اللاعبين",discoverFans:"اكتشف المشجعين",teams:"الفرق",subtitle:"تواصل مع المشجعين وانشر عن الفرق التي تدعمها.",teamFirst:"فريقك. مجتمعك.",fanOnlyNote:"خلاصة للمشجعين فقط · تنتهي المنشورات بعد 24 ساعة",postForTeam:"انشر لفريقك",composerPlaceholder:"ما أخبار فريقك؟ (500 حرف كحد أقصى)",chooseTeam:"اختر فريقًا تتابعه",selectTeam:"اختر فريقًا متابَعًا",addPhoto:"إضافة صورة",photoLimit:"اختر صورة JPG أو PNG أو WebP بحجم يصل إلى 8 ميغابايت.",photoPreview:"معاينة الصورة",removePhoto:"إزالة الصورة",posting:"جارٍ النشر…",post:"انشر في Fan HoopFeed",moderating:"جارٍ فحص المنشور للسلامة…",published:"تم نشر منشورك.",publishFailed:"تعذّر نشر المنشور.",commentFailed:"تعذّر نشر التعليق.",following:"تتابعه",followFan:"متابعة مشجع",like:"إعجاب",comment:"تعليق",comments:"التعليقات",commentPlaceholder:"أضف تعليقًا…",send:"إرسال",expires:"ينتهي",postPhoto:"صورة منشور المشجع",fan:"مشجع",loading:"جارٍ تحميل Fan HoopFeed…",followTeamFirst:"تابع فريقًا قبل النشر.",recentPosts:"أحدث منشورات المشجعين",emptyKicker:"مجتمع المشجعين",emptyTitle:"تبدأ خلاصة المشجعين هنا.",emptyBody:"تابع الفرق والمشجعين لرؤية المنشورات والمحادثات.",teamHub:"مركز الفريق",addVideo:"إضافة فيديو",share:"مشاركة",archive:"أرشفة",delete:"حذف",check:"Check",checked:"تم التحديد",videoLimit:"استخدم MP4 أو WebM أو MOV بحجم يصل إلى 50 ميغابايت.",deleteConfirm:"هل تريد حذف هذا المنشور نهائيًا؟",archiveSuccess:"تمت أرشفة المنشور.",deleteSuccess:"تم حذف المنشور.",linkCopied:"تم نسخ رابط المنشور.",shareFailed:"تعذرت المشاركة. انسخ رابط الصفحة وحاول مرة أخرى.",shareTitle:"HoopCheck Fan HQ",videoPostLabel:"فيديو منشور المشجع"},
 es:{fansOnly:"Solo cuentas de fans",separateSurface:"Fan HoopFeed es independiente del HoopFeed de jugadores.",playerFeed:"HoopFeed de jugadores",teamFirst:"Tu equipo. Tu gente.",postForTeam:"PUBLICA PARA TU EQUIPO",composerPlaceholder:"¿Qué pasa con tu equipo? (máximo 500 caracteres)",photoLimit:"Elige una foto JPG, PNG o WebP de hasta 8 MB.",photoPreview:"Vista previa de la foto",removePhoto:"Quitar foto",posting:"Publicando…",moderating:"Comprobando la seguridad de la publicación…",published:"Tu publicación ya está activa.",publishFailed:"No se pudo publicar tu publicación.",commentFailed:"No se pudo publicar tu comentario.",commentPlaceholder:"Añadir un comentario…",expires:"Caduca",postPhoto:"Foto de publicación de fan",fan:"Fan",loading:"Cargando Fan HoopFeed…",followTeamFirst:"Sigue a un equipo antes de publicar.",recentPosts:"Publicaciones recientes de fans",emptyKicker:"COMUNIDAD DE FANS",shareTitle:"HoopCheck Fan HQ",videoPostLabel:"Vídeo de publicación de fan"},
 fr:{fansOnly:"Comptes de fans uniquement",separateSurface:"Le Fan HQ est séparé de celui des joueurs.",playerFeed:"HoopFeed des joueurs",teamFirst:"Votre équipe. Votre communauté.",postForTeam:"PUBLIER POUR VOTRE ÉQUIPE",composerPlaceholder:"Quoi de neuf dans votre équipe ? (500 caractères max.)",photoLimit:"Choisissez une photo JPG, PNG ou WebP de 8 Mo maximum.",photoPreview:"Aperçu de la photo",removePhoto:"Retirer la photo",posting:"Publication…",moderating:"Vérification de la sécurité de la publication…",published:"Votre publication est en ligne.",publishFailed:"Impossible de publier votre contenu.",commentFailed:"Impossible de publier votre commentaire.",commentPlaceholder:"Ajouter un commentaire…",expires:"Expire",postPhoto:"Photo de publication d’un fan",fan:"Fan",loading:"Chargement du Fan HQ…",followTeamFirst:"Suivez une équipe avant de publier.",recentPosts:"Publications récentes des fans",emptyKicker:"COMMUNAUTÉ DE FANS",shareTitle:"HoopCheck Fan HQ",videoPostLabel:"Vidéo de publication de fan"},
 de:{fansOnly:"Nur Fan-Konten",separateSurface:"Der Fan-HoopFeed ist vom Spieler-HoopFeed getrennt.",playerFeed:"Spieler-HoopFeed",teamFirst:"Dein Team. Deine Community.",postForTeam:"FÜR DEIN TEAM POSTEN",composerPlaceholder:"Was gibt es Neues bei deinem Team? (max. 500 Zeichen)",photoLimit:"Wähle ein JPG-, PNG- oder WebP-Foto bis 8 MB.",photoPreview:"Fotovorschau",removePhoto:"Foto entfernen",posting:"Wird veröffentlicht…",moderating:"Beitrag wird auf Sicherheit geprüft…",published:"Dein Beitrag ist online.",publishFailed:"Dein Beitrag konnte nicht veröffentlicht werden.",commentFailed:"Dein Kommentar konnte nicht veröffentlicht werden.",commentPlaceholder:"Kommentar hinzufügen…",expires:"Läuft ab",postPhoto:"Foto eines Fan-Beitrags",fan:"Fan",loading:"Fan-HoopFeed wird geladen…",followTeamFirst:"Folge zuerst einem Team, bevor du postest.",recentPosts:"Neueste Fan-Beiträge",emptyKicker:"FAN-COMMUNITY",shareTitle:"HoopCheck Fan-HoopFeed",videoPostLabel:"Video eines Fan-Beitrags"},
 az:{fansOnly:"Yalnız fan hesabları",separateSurface:"Fan HoopFeed oyunçu HoopFeed-indən ayrıdır.",playerFeed:"Oyunçu HoopFeed-i",teamFirst:"Sənin komandan. Sənin icman.",postForTeam:"KOMANDAN ÜÇÜN PAYLAŞ",composerPlaceholder:"Komandanızda nə baş verir? (maksimum 500 simvol)",photoLimit:"8 MB-a qədər JPG, PNG və ya WebP şəkli seçin.",photoPreview:"Şəkil önizləməsi",removePhoto:"Şəkli sil",posting:"Paylaşılır…",moderating:"Paylaşım təhlükəsizlik üçün yoxlanılır…",published:"Paylaşımınız yayımlandı.",publishFailed:"Paylaşımı yayımlamaq mümkün olmadı.",commentFailed:"Şərhi yayımlamaq mümkün olmadı.",commentPlaceholder:"Şərh əlavə edin…",expires:"Bitmə vaxtı",postPhoto:"Fan paylaşımının şəkli",fan:"Fan",loading:"Fan HoopFeed yüklənir…",followTeamFirst:"Paylaşmazdan əvvəl komandanı izləyin.",recentPosts:"Son fan paylaşımları",emptyKicker:"FAN İCMASI",shareTitle:"HoopCheck Fan HQ",videoPostLabel:"Fan paylaşım videosu"}
};


const teamSurfaceCopy: Partial<Record<Language, { subtitle: string; composer: string }>> = {
  en: { subtitle: "The Fan HQ for {team}. Connect with supporters and share team updates.", composer: "Post to {team} fans…" },
  es: { subtitle: "El Fan HQ de {team}. Conecta con otros seguidores y comparte novedades.", composer: "Publica para los fans de {team}…" },
  fr: { subtitle: "Le Fan HQ de {team}. Échangez avec les supporters et partagez les actualités.", composer: "Publier pour les fans de {team}…" },
  de: { subtitle: "Das Fan-HQ von {team}. Vernetze dich mit Fans und teile Team-Updates.", composer: "Für die Fans von {team} posten…" },
  az: { subtitle: "{team} fanlarının mərkəzi. Digər tərəfdarlarla əlaqə qurun və yenilikləri paylaşın.", composer: "{team} fanları üçün paylaşım et…" },
  tr: { subtitle: "{team} taraftarlarının buluşma noktası. Taraftarlarla bağlantı kurun ve takım haberlerini paylaşın.", composer: "{team} taraftarları için paylaş…" },
  pt: { subtitle: "O Fan HQ de {team}. Ligue-se aos adeptos e partilhe novidades da equipa.", composer: "Publicar para os fãs de {team}…" },
  it: { subtitle: "Il Fan HQ di {team}. Connettiti con i tifosi e condividi aggiornamenti.", composer: "Pubblica per i fan di {team}…" },
  ru: { subtitle: "Фан-центр {team}. Общайтесь с болельщиками и делитесь новостями команды.", composer: "Опубликовать для болельщиков {team}…" },
  pl: { subtitle: "Fan HQ drużyny {team}. Łącz się z kibicami i udostępniaj aktualności.", composer: "Opublikuj dla kibiców {team}…" },
  zh: { subtitle: "{team} 球迷中心。与其他球迷交流并分享球队动态。", composer: "发布给 {team} 的球迷…" },
  ja: { subtitle: "{team}のファンHQ。ファンとつながり、チームの最新情報を共有しましょう。", composer: "{team}のファンに投稿…" },
  fi: { subtitle: "{team} fanien keskus. Yhdistä kannattajiin ja jaa joukkueen uutisia.", composer: "Julkaise {team} -joukkueen faneille…" },
  he: { subtitle: "מרכז האוהדים של {team}. התחברו לאוהדים ושתפו עדכונים על הקבוצה.", composer: "פרסום לאוהדי {team}…" },
  lt: { subtitle: "{team} gerbėjų centras. Bendraukite su sirgaliais ir dalykitės naujienomis.", composer: "Skelbti {team} gerbėjams…" },
  uk: { subtitle: "Фан-центр {team}. Спілкуйтеся з уболівальниками та діліться новинами команди.", composer: "Опублікувати для вболівальників {team}…" },
  sr: { subtitle: "Fan centar za {team}. Poveži se sa navijačima i deli novosti o timu.", composer: "Објави за навијаче {team}…" },
  el: { subtitle: "Το Fan HQ της {team}. Συνδεθείτε με φιλάθλους και μοιραστείτε νέα της ομάδας.", composer: "Δημοσίευση για τους φιλάθλους της {team}…" },
  ar: { subtitle: "مركز مشجعي {team}. تواصل مع المشجعين وشارك أخبار الفريق.", composer: "انشر لجماهير {team}…" },
};


const teamEmptyCopy: Partial<Record<Language, { title: string; body: string }>> = {
  en: { title: "No fan posts for {team} yet", body: "Start the conversation by sharing the first update with this team's supporters." },
  es: { title: "Aún no hay publicaciones de fans de {team}", body: "Inicia la conversación compartiendo la primera novedad con los seguidores de este equipo." },
  fr: { title: "Pas encore de publication de fans pour {team}", body: "Lancez la conversation en partageant la première actualité avec les supporters de cette équipe." },
  de: { title: "Noch keine Fan-Beiträge für {team}", body: "Starte das Gespräch und teile das erste Update mit den Fans dieses Teams." },
  tr: { title: "{team} için henüz hayran paylaşımı yok", body: "Bu takımın taraftarlarıyla ilk güncellemeyi paylaşarak sohbeti başlatın." },
  pt: { title: "Ainda não há publicações de fãs para {team}", body: "Comece a conversa partilhando a primeira novidade com os adeptos desta equipa." },
  it: { title: "Ancora nessun post dei fan per {team}", body: "Inizia la conversazione condividendo il primo aggiornamento con i tifosi di questa squadra." },
  el: { title: "Δεν υπάρχουν ακόμη αναρτήσεις φιλάθλων για την {team}", body: "Ξεκινήστε τη συζήτηση μοιράζοντας την πρώτη ενημέρωση με τους φιλάθλους της ομάδας." },
  ar: { title: "لا توجد منشورات جماهيرية لـ {team} بعد", body: "ابدأ المحادثة بمشاركة أول تحديث مع مشجعي هذا الفريق." },
  ru: { title: "Пока нет публикаций болельщиков {team}", body: "Начните общение — поделитесь первой новостью с болельщиками этой команды." },
  az: { title: "{team} üçün hələ fan paylaşımı yoxdur", body: "Bu komandanın azarkeşləri ilə ilk yeniliyi paylaşaraq söhbətə başlayın." },
  pl: { title: "Brak wpisów fanów o drużynie {team}", body: "Rozpocznij rozmowę, udostępniając pierwszą aktualizację kibicom tej drużyny." },
  zh: { title: "{team} 暂无球迷动态", body: "分享第一条球队动态，与这支球队的球迷开启交流。" },
  ja: { title: "{team}のファン投稿はまだありません", body: "最初のチーム情報を共有して、ファンとの会話を始めましょう。" },
  sr: { title: "Još nema objava navijača za {team}", body: "Započni razgovor tako što ćeš podeliti prvu novost sa navijačima ovog tima." },
  fi: { title: "Joukkueella {team} ei ole vielä fanijulkaisuja", body: "Aloita keskustelu jakamalla ensimmäinen päivitys joukkueen kannattajille." },
  he: { title: "עדיין אין פוסטים של אוהדים עבור {team}", body: "התחילו את השיחה בשיתוף העדכון הראשון עם אוהדי הקבוצה." },
  lt: { title: "Komanda {team} dar neturi gerbėjų įrašų", body: "Pradėkite pokalbį pasidalydami pirmąja naujiena su šios komandos gerbėjais." },
  uk: { title: "Для команди {team} ще немає дописів уболівальників", body: "Почніть спілкування — поділіться першою новиною з уболівальниками цієї команди." },
};

export function fanFeedTeamEmptyTitle(teamName: string, language: Language): string {
  return withTeam(teamEmptyCopy[language]?.title || teamEmptyCopy.en!.title, teamName);
}

export function fanFeedTeamEmptyBody(teamName: string, language: Language): string {
  return withTeam(teamEmptyCopy[language]?.body || teamEmptyCopy.en!.body, teamName);
}


const refreshCopy: Record<Language, { refresh: string; refreshing: string }> = {
  en: { refresh: "Refresh", refreshing: "Refreshing…" },
  es: { refresh: "Actualizar", refreshing: "Actualizando…" },
  fr: { refresh: "Actualiser", refreshing: "Actualisation…" },
  de: { refresh: "Aktualisieren", refreshing: "Wird aktualisiert…" },
  tr: { refresh: "Yenile", refreshing: "Yenileniyor…" },
  pt: { refresh: "Atualizar", refreshing: "A atualizar…" },
  it: { refresh: "Aggiorna", refreshing: "Aggiornamento…" },
  el: { refresh: "Ανανέωση", refreshing: "Γίνεται ανανέωση…" },
  ar: { refresh: "تحديث", refreshing: "جارٍ التحديث…" },
  ru: { refresh: "Обновить", refreshing: "Обновление…" },
  az: { refresh: "Yenilə", refreshing: "Yenilənir…" },
  pl: { refresh: "Odśwież", refreshing: "Odświeżanie…" },
  zh: { refresh: "刷新", refreshing: "正在刷新…" },
  ja: { refresh: "更新", refreshing: "更新中…" },
  sr: { refresh: "Osveži", refreshing: "Osvežavanje…" },
  fi: { refresh: "Päivitä", refreshing: "Päivitetään…" },
  he: { refresh: "רענון", refreshing: "מרענן…" },
  lt: { refresh: "Atnaujinti", refreshing: "Atnaujinama…" },
  uk: { refresh: "Оновити", refreshing: "Оновлення…" },
};

export function fanFeedRefreshLabel(language: Language, isRefreshing: boolean): string {
  const labels = refreshCopy[language] || refreshCopy.en;
  return isRefreshing ? labels.refreshing : "↻ " + labels.refresh;
}


const refreshErrorCopy: Record<Language, string> = {
  en: "Could not refresh the feed. Please try again.",
  es: "No se pudo actualizar el feed. Inténtalo de nuevo.",
  fr: "Impossible d’actualiser le fil. Réessayez.",
  de: "Der Feed konnte nicht aktualisiert werden. Bitte versuche es erneut.",
  tr: "Akış yenilenemedi. Lütfen tekrar deneyin.",
  pt: "Não foi possível atualizar o feed. Tente novamente.",
  it: "Impossibile aggiornare il feed. Riprova.",
  el: "Δεν ήταν δυνατή η ανανέωση της ροής. Δοκιμάστε ξανά.",
  ar: "تعذر تحديث الموجز. يُرجى المحاولة مرة أخرى.",
  ru: "Не удалось обновить ленту. Попробуйте ещё раз.",
  az: "Lenti yeniləmək mümkün olmadı. Yenidən cəhd edin.",
  pl: "Nie udało się odświeżyć kanału. Spróbuj ponownie.",
  zh: "动态刷新失败，请重试。",
  ja: "フィードを更新できませんでした。もう一度お試しください。",
  sr: "Nije moguće osvežiti feed. Pokušajte ponovo.",
  fi: "Syötteen päivitys epäonnistui. Yritä uudelleen.",
  he: "לא ניתן לרענן את הפיד. נסו שוב.",
  lt: "Nepavyko atnaujinti srauto. Bandykite dar kartą.",
  uk: "Не вдалося оновити стрічку. Спробуйте ще раз.",
};

export function fanFeedRefreshError(language: Language): string {
  return refreshErrorCopy[language] || refreshErrorCopy.en;
}


const expiryCopy: Record<Language, { expired: string; minutes: string; hours: string }> = {
  en: { expired: "Expired", minutes: "m left", hours: "h left" },
  es: { expired: "Caducado", minutes: " min restantes", hours: " h restantes" },
  fr: { expired: "Expiré", minutes: " min restantes", hours: " h restantes" },
  de: { expired: "Abgelaufen", minutes: " Min. übrig", hours: " Std. übrig" },
  tr: { expired: "Süresi doldu", minutes: " dk kaldı", hours: " sa kaldı" },
  pt: { expired: "Expirado", minutes: " min restantes", hours: " h restantes" },
  it: { expired: "Scaduto", minutes: " min rimanenti", hours: " h rimanenti" },
  el: { expired: "Έληξε", minutes: " λεπ. απομένουν", hours: " ώρ. απομένουν" },
  ar: { expired: "انتهت المدة", minutes: " د متبقية", hours: " س متبقية" },
  ru: { expired: "Истекло", minutes: " мин. осталось", hours: " ч осталось" },
  az: { expired: "Vaxtı bitib", minutes: " dəq. qalıb", hours: " saat qalıb" },
  pl: { expired: "Wygasło", minutes: " min pozostało", hours: " godz. pozostało" },
  zh: { expired: "已过期", minutes: "分钟后到期", hours: "小时后到期" },
  ja: { expired: "期限切れ", minutes: "分残り", hours: "時間残り" },
  sr: { expired: "Isteklo", minutes: " min preostalo", hours: " h preostalo" },
  fi: { expired: "Vanhentunut", minutes: " min jäljellä", hours: " h jäljellä" },
  he: { expired: "פג תוקף", minutes: " דק׳ נותרו", hours: " שע׳ נותרו" },
  lt: { expired: "Baigėsi", minutes: " min. liko", hours: " val. liko" },
  uk: { expired: "Термін минув", minutes: " хв залишилося", hours: " год залишилося" },
};

export function fanFeedExpiryLabel(expiresAt: string, now: number, language: Language): string {
  const remaining = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 60000));
  const labels = expiryCopy[language] || expiryCopy.en;
  if (remaining <= 0) return labels.expired;
  if (remaining < 60) return remaining + labels.minutes;
  return Math.ceil(remaining / 60) + labels.hours;
}


const loadErrorCopy: Record<Language, string> = {
  en: "Could not load the fan feed. Please try again.",
  es: "No se pudo cargar el feed de fans. Inténtalo de nuevo.",
  fr: "Impossible de charger le fil des fans. Réessayez.",
  de: "Der Fan-Feed konnte nicht geladen werden. Bitte versuche es erneut.",
  tr: "Fan akışı yüklenemedi. Lütfen tekrar deneyin.",
  pt: "Não foi possível carregar o feed de fãs. Tente novamente.",
  it: "Impossibile caricare il feed dei fan. Riprova.",
  el: "Δεν ήταν δυνατή η φόρτωση της ροής φιλάθλων. Δοκιμάστε ξανά.",
  ar: "تعذر تحميل موجز المشجعين. يُرجى المحاولة مرة أخرى.",
  ru: "Не удалось загрузить ленту фанатов. Попробуйте ещё раз.",
  az: "Fan lentini yükləmək mümkün olmadı. Yenidən cəhd edin.",
  pl: "Nie udało się załadować kanału fanów. Spróbuj ponownie.",
  zh: "无法加载粉丝动态，请重试。",
  ja: "ファンフィードを読み込めませんでした。もう一度お試しください。",
  sr: "Nije moguće učitati feed navijača. Pokušajte ponovo.",
  fi: "Fanisyötettä ei voitu ladata. Yritä uudelleen.",
  he: "לא ניתן לטעון את פיד האוהדים. נסו שוב.",
  lt: "Nepavyko įkelti fanų srauto. Bandykite dar kartą.",
  uk: "Не вдалося завантажити стрічку фанатів. Спробуйте ще раз.",
};

export function fanFeedLoadError(language: Language): string {
  return loadErrorCopy[language] || loadErrorCopy.en;
}


const removeVideoCopy: Record<Language, string> = {
  en: "Remove video", es: "Quitar vídeo", fr: "Retirer la vidéo", de: "Video entfernen",
  tr: "Videoyu kaldır", pt: "Remover vídeo", it: "Rimuovi video", el: "Αφαίρεση βίντεο",
  ar: "إزالة الفيديو", ru: "Удалить видео", az: "Videonu sil", pl: "Usuń wideo",
  zh: "移除视频", ja: "動画を削除", sr: "Ukloni video", fi: "Poista video",
  he: "הסרת סרטון", lt: "Pašalinti vaizdo įrašą", uk: "Видалити відео",
};

export function fanFeedRemoveVideoLabel(language: Language): string {
  return removeVideoCopy[language] || removeVideoCopy.en;
}

function withTeam(template: string, teamName: string) {
  return template.replaceAll("{team}", teamName);
}

export function fanFeedTeamSubtitle(teamName: string, language: Language): string {
  return withTeam(teamSurfaceCopy[language]?.subtitle || teamSurfaceCopy.en!.subtitle, teamName);
}

export function fanFeedTeamComposerPlaceholder(teamName: string, language: Language): string {
  return withTeam(teamSurfaceCopy[language]?.composer || teamSurfaceCopy.en!.composer, teamName);
}

const fanHqCanonical: Partial<Record<keyof typeof en, string>> = {
  title: "Fan HQ",
  kicker: "FAN HQ · CLUB COMMUNITIES",
  membershipRequired: "Fan HQ requires an active Pro or Premium fan membership",
  membershipDescription: "An active Pro or Premium fan membership is required to access your club groups.",
  separateSurface: "Fan HQ is separate from player HoopFeed.",
  loading: "Loading Fan HQ…",
  published: "Your post is live in your club Fan Group.",
  shareTitle: "HoopCheck Fan HQ",
};

export function fanFeedI18n(key: keyof typeof en, language: Language, sharedFallback?: string): string {
  if (key === "post") return localized[language]?.post ?? "Post";
  if (fanHqCanonical[key]) return fanHqCanonical[key]!;
  // The shared translator humanizes unknown keys (e.g. "Feed Explainer").
  // Our complete English dictionary must precede that display-only fallback.
  return localized[language]?.[key] ?? additional[language]?.[key] ?? en[key] ?? sharedFallback ?? key;
}
