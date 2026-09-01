# Adds landing v2 dictionary keys (part 2: de, es, fr).
import io

keys = {
  'de': {
    "landing.hero2.sub": "Barada Code macht aus einer Idee in normaler Sprache ein echtes, funktionierendes Projekt — echte Dateien, Editor, Live-Vorschau und Publishing mit einem Klick auf deine eigene Subdomain.",
    "landing.how.title": "So funktioniert es",
    "landing.how.s1.title": "Beschreibe deine Idee",
    "landing.how.s1.desc": "„Baue eine Website für ein Café namens Moon Coffee.“ Normale Sprache genügt — Barada fragt nach, wenn etwas Wichtiges fehlt.",
    "landing.how.s2.title": "Die KI baut echte Dateien",
    "landing.how.s2.desc": "Der KI-Ingenieur erzeugt echte Projektdateien, kein Mockup. Erlebe jeden Schritt live im Chat.",
    "landing.how.s3.title": "Vorschau & verfeinern",
    "landing.how.s3.desc": "Sieh das Ergebnis sofort und verfeinere es im Chat: „Mach die Hero größer“, „Ändere die Farbe zu Smaragd“.",
    "landing.how.s4.title": "Auf deiner Subdomain veröffentlichen",
    "landing.how.s4.desc": "Mit einem Klick ist dein Projekt online auf yourname.iuw7a.com — oder verbinde deine eigene Domain.",
    "landing.publish.title": "Publishing eingebaut",
    "landing.publish.desc": "Jedes Projekt kann auf seiner eigenen Subdomain live gehen — mit Redeploy, Unpublish und Verlauf. Eigene Domain jederzeit möglich, die Verifizierung passiert automatisch.",
    "landing.story.body": "Wir glauben, dass der Abstand zwischen einer Idee und funktionierender Software ein Gespräch sein sollte. Barada Code verbindet einen dialogischen KI-Ingenieur mit einer echten Entwicklungsumgebung — Projekte, Dateien, Editoren, Vorschau und Hosting — in fünf Sprachen.",
    "footer.tagline": "Der KI-Softwareingenieur. Beschreiben — veröffentlichen.",
  },
  'es': {
    "landing.hero2.sub": "Barada Code convierte una idea en lenguaje natural en un proyecto real y funcional — archivos reales, editor de código, vista previa en vivo y publicación con un clic en tu propio subdominio.",
    "landing.how.title": "Cómo funciona",
    "landing.how.s1.title": "Describe tu idea",
    "landing.how.s1.desc": "\"Crea un sitio web para una cafetería llamada Moon Coffee.\" El lenguaje natural basta — Barada pregunta si falta algo importante.",
    "landing.how.s2.title": "La IA construye archivos reales",
    "landing.how.s2.desc": "El ingeniero IA crea archivos de proyecto reales, no una maqueta. Mira cada paso en vivo en tu chat.",
    "landing.how.s3.title": "Previsualiza y refina",
    "landing.how.s3.desc": "Ve el resultado al instante y refínalo conversando: \"haz el héroe más grande\", \"cambia el color a esmeralda\".",
    "landing.how.s4.title": "Publica en tu subdominio",
    "landing.how.s4.desc": "Con un clic tu proyecto está en línea en yourname.iuw7a.com — o conecta tu propio dominio.",
    "landing.publish.title": "Publicación integrada",
    "landing.publish.desc": "Cada proyecto puede estar en línea en su propio subdominio, con redeploy, unpublish e historial. Añade tu dominio personalizado cuando quieras — la verificación es automática.",
    "landing.story.body": "Creemos que la distancia entre una idea y un software funcionando debería ser una conversación. Barada Code une un ingeniero de IA conversacional con un entorno de desarrollo real — proyectos, archivos, editores, vistas previas y hosting — para ir de la idea al producto, en cinco idiomas.",
    "footer.tagline": "El ingeniero de software IA. Descríbelo — publícalo.",
  },
  'fr': {
    "landing.hero2.sub": "Barada Code transforme une idée en langage naturel en un vrai projet fonctionnel — vrais fichiers, éditeur de code, aperçu en direct et publication en un clic sur votre propre sous-domaine.",
    "landing.how.title": "Comment ça marche",
    "landing.how.s1.title": "Décrivez votre idée",
    "landing.how.s1.desc": "« Crée un site web pour un café nommé Moon Coffee. » Le langage naturel suffit — Barada pose une question si quelque chose d'important manque.",
    "landing.how.s2.title": "L'IA construit les vrais fichiers",
    "landing.how.s2.desc": "L'ingénieur IA crée de vrais fichiers de projet, pas une maquette. Suivez chaque étape en direct dans votre chat.",
    "landing.how.s3.title": "Aperçu et affinage",
    "landing.how.s3.desc": "Voyez le résultat instantanément, puis affinez en discutant : « agrandis le hero », « passe la couleur en émeraude ».",
    "landing.how.s4.title": "Publiez sur votre sous-domaine",
    "landing.how.s4.desc": "En un clic, votre projet est en ligne sur yourname.iuw7a.com — ou connectez votre propre domaine.",
    "landing.publish.title": "La publication intégrée",
    "landing.publish.desc": "Chaque projet peut être en ligne sur son propre sous-domaine, avec redeploy, unpublish et historique. Ajoutez votre domaine personnalisé quand vous voulez — la vérification est automatique.",
    "landing.story.body": "Nous croyons que la distance entre une idée et un logiciel fonctionnel devrait être une conversation. Barada Code associe un ingénieur IA conversationnel à un vrai environnement de développement — projets, fichiers, éditeurs, aperçus et hébergement — en cinq langues.",
    "footer.tagline": "L'ingénieur logiciel IA. Décrivez — publiez.",
  },
}

anchor = '  "landing.hero.title":'
for lang, add in keys.items():
    p = f'src/lib/i18n/dictionaries/{lang}.ts'
    s = io.open(p, encoding='utf-8').read()
    assert anchor in s, p
    lines = ''.join(
        f'  "{k}": "{v}",\n' for k, v in add.items()
    )
    s = s.replace(anchor, lines + anchor, 1)
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    print('updated', p)
