# Adds landing v2 dictionary keys (idempotent: skips if key exists).
import io

keys = {
  'en': {
    "landing.hero2.sub": "Barada Code turns a plain-language idea into a real, working project — real files, a code editor, live preview and one-click publishing to your own subdomain.",
    "landing.how.title": "How it works",
    "landing.how.s1.title": "Describe your idea",
    "landing.how.s1.desc": "\"Build a coffee shop website called Moon Coffee.\" Plain language is enough — Barada asks if anything important is missing.",
    "landing.how.s2.title": "AI builds the real files",
    "landing.how.s2.desc": "The AI engineer creates actual project files, not a mockup. Watch every step happen live in your chat.",
    "landing.how.s3.title": "Preview & refine",
    "landing.how.s3.desc": "See the result instantly, then refine by chatting: \"make the hero larger\", \"change the color to emerald\".",
    "landing.how.s4.title": "Publish to your subdomain",
    "landing.how.s4.desc": "One click puts your project online at yourname.iuw7a.com — or connect your own custom domain.",
    "landing.publish.title": "Publishing, built in",
    "landing.publish.desc": "Every project can go live on its own subdomain with redeploy, unpublish and deployment history. Bring your own custom domain when you're ready — verification is automatic.",
    "landing.story.body": "We believe the distance between an idea and working software should be one conversation. Barada Code pairs a conversational AI engineer with a real development environment — projects, files, editors, previews and hosting — so anyone can go from idea to shipped, in five languages.",
    "footer.tagline": "The AI software engineer. Describe it — ship it.",
  },
  'ar': {
    "landing.hero2.sub": "يحوّل Barada Code فكرتك باللغة العادية إلى مشروع حقيقي يعمل — ملفات فعلية، محرر أكواد، معاينة مباشرة، ونشر بضغطة واحدة على نطاقك الخاص.",
    "landing.how.title": "كيف يعمل",
    "landing.how.s1.title": "صف فكرتك",
    "landing.how.s1.desc": "\"سوي لي موقع مقهى اسمه Moon Coffee.\" لغة عادية تكفي — ويسألك Barada إن كان شيء مهم ناقص.",
    "landing.how.s2.title": "الذكاء الاصطناعي يبني الملفات الحقيقية",
    "landing.how.s2.desc": "مهندس الذكاء الاصطناعي ينشئ ملفات مشروع فعلية وليس نموذجاً — وشاهد كل خطوة مباشرة في محادثتك.",
    "landing.how.s3.title": "عاين وطوّر",
    "landing.how.s3.desc": "شاهد النتيجة فوراً، ثم طوّرها بالمحادثة: \"كبّر القسم الرئيسي\"، \"غيّر اللون للأخضر\".",
    "landing.how.s4.title": "انشر على نطاقك",
    "landing.how.s4.desc": "بضغطة واحدة يصبح مشروعك على الإنترنت على yourname.iuw7a.com — أو اربط دومينك الخاص.",
    "landing.publish.title": "النشر مدمج",
    "landing.publish.desc": "كل مشروع يمكن أن يبقى مباشراً على نطاقه الخاص مع إعادة نشر وإلغاء النشر وسجل النشر. واربط دومينك المخصص متى ما جهزت — التحقق تلقائي.",
    "landing.story.body": "نؤمن أن المسافة بين الفكرة والبرمجية العاملة يجب أن تكون محادثة واحدة. يجمع Barada Code بين مهندس ذكاء اصطناعي محادثي وبيئة تطوير حقيقية — مشاريع وملفات ومحررات ومعاينات واستضافة — لتبدأ من الفكرة وتنتهي منتجاً، بخمس لغات.",
    "footer.tagline": "مهندس الذكاء الاصطناعي. صِفها — وانشرها.",
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
