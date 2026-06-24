// Choosy — minimal i18n (Hebrew default / English option).
// Static text carries data-i18n (textContent), data-i18n-html (innerHTML, for
// strings with <span>/<br>), or data-i18n-ph (placeholder). Dynamic JS strings
// (categories, color-family chip names, errors) call the global t(key).
// Product names/colors stay in their source language (Hebrew catalogs).
var I18N = {
  he: {
    hero_title: 'לא לחפש, <span class="accent">למצוא</span>',
    hero_sub: 'יש לנו כבר מספיק החלטות בחיים. אולי בגלל זה בכל פעם שמתחילים לקנות בגדים ברשת, הראש מתחיל להסתובב מרוב אפשרויות. במקום להשוות וללכת לאיבוד בין עשרות פריטים — נראה לכם <span class="accent">שניים</span> בכל פעם, אתם תבחרו את מה שתאהבו, עד שנשאר מוצר אחד מנצח. קל, מהיר, וכיף.',
    start: 'בואו נתחיל',
    trust_free: 'חינם לגמרי',
    trust_nosignup: 'בלי הרשמה, בלי פרטים אישיים',
    trust_nocommit: 'בלי התחייבות — קונים ישירות בחנות שאתם מכירים',
    trust_anon: 'אנונימי · לא מוכרים את המידע שלכם',
    privacy_note: 'המידע נשמר אנונימי ומשמש רק כדי לשפר את החוויה —<br>בלי שם, בלי מייל, בלי מכירה לאף אחד.',
    how_1: 'בוחרים למי ומה קונים',
    how_2: 'בוחרים בין שני פריטים בכל פעם',
    how_3: 'בוחרים את מה שאוהבים — עד המנצח',
    back: '→ חזרה',
    q_who: 'למי אנחנו קונים?',
    choice_boy_02: 'בן · 0-2', choice_girl_02: 'בת · 0-2',
    choice_boy_28: 'בן · 2-8', choice_girl_28: 'בת · 2-8',
    q_what: 'מה מחפשים?',
    q_refine: 'עוד משהו שיעזור? <span class="setup-q-sub">(אפשר לדלג)</span>',
    label_colors: 'צבעים מועדפים',
    label_budget: 'תקציב',
    budget_upto: 'עד',
    play: 'מתחילים לבחור!',
    skip: 'בלי סינון — הציגו הכל',
    loading_default: 'אוספים בשבילכם את הפריטים הכי חמודים...',
    game_hint: 'איזה מהם אתם אוהבים יותר?',
    tap_hint: 'טאפ על מה שאוהבים',
    or: 'או',
    exit: '→ יציאה',
    undo: '↶ ביטול הבחירה האחרונה',
    winner_label: 'מצאתם! זאת הבחירה שלכם',
    buy_prefix: 'לקנייה ב-',
    keep: 'המנצח ממשיך להתמודד',
    restart: 'ערבב הכל מחדש',
    winner_fb: 'איך הייתה החוויה? ספרו לנו »',
    fab: 'פידבק',
    fb_title: 'איך היה?',
    fb_intro: 'נשמח לכל פידבק כדי להשתפר — הכל אנונימי.',
    fb_q_ease: 'כמה היה קל לבחור?',
    fb_end_hard: 'קשה', fb_end_easy: 'קל מאוד',
    fb_q_buy: 'הייתם קונים ככה?',
    fb_buy_yes: 'כן, בדיוק', fb_buy_maybe: 'אולי', fb_buy_no: 'לא',
    fb_q_improve: 'מה היית משפר? <span class="fb-opt">(רשות)</span>',
    fb_ph: 'כתבו לנו...',
    fb_submit: 'שליחה',
    fb_thanks_title: 'תודה!',
    fb_thanks_sub: 'הפידבק שלך עוזר לנו להשתפר.',
    cat_tops: 'חולצות', cat_bottoms: 'מכנסיים', cat_bodysuits: 'בגדי גוף', cat_dresses: 'שמלות', cat_swim: 'בגדי ים',
    'color_שחור': 'שחור', 'color_לבן': 'לבן', 'color_אפור': 'אפור', 'color_כחול': 'כחול', 'color_ירוק': 'ירוק',
    'color_ורוד': 'ורוד', 'color_אדום': 'אדום', 'color_צהוב': 'צהוב', 'color_כתום': 'כתום', 'color_סגול': 'סגול',
    'color_חום': 'חום', 'color_מצויר': 'מצויר', 'color_אחר': 'אחר',
    err_fewitems: 'אין מספיק פריטים בקטגוריה הזו עדיין. נסו בחירה אחרת.',
    err_generic: 'משהו השתבש. ננסה שוב?',
    store_fallback: 'חנות'
  },
  en: {
    hero_title: 'Don\'t search, <span class="accent">find</span>',
    hero_sub: 'We already have enough decisions in life. Maybe that\'s why shopping for clothes online makes your head spin with options. Instead of comparing dozens of items and getting lost — we show you <span class="accent">two</span> at a time, you pick the one you love, until a single winner remains. Easy, fast, and fun.',
    start: 'Let\'s start',
    trust_free: 'Completely free',
    trust_nosignup: 'No signup, no personal details',
    trust_nocommit: 'No commitment — buy directly at the store you know',
    trust_anon: 'Anonymous · we don\'t sell your data',
    privacy_note: 'Your data stays anonymous and is used only to improve the experience —<br>no name, no email, no selling to anyone.',
    how_1: 'Pick who & what you\'re buying',
    how_2: 'Choose between two items at a time',
    how_3: 'Pick what you love — down to one winner',
    back: '← Back',
    q_who: 'Who are we shopping for?',
    choice_boy_02: 'Boy · 0-2', choice_girl_02: 'Girl · 0-2',
    choice_boy_28: 'Boy · 2-8', choice_girl_28: 'Girl · 2-8',
    q_what: 'What are you looking for?',
    q_refine: 'Anything else that helps? <span class="setup-q-sub">(optional)</span>',
    label_colors: 'Preferred colors',
    label_budget: 'Budget',
    budget_upto: 'Up to',
    play: 'Start choosing!',
    skip: 'No filters — show all',
    loading_default: 'Gathering the cutest items for you...',
    game_hint: 'Which one do you like more?',
    tap_hint: 'Tap what you love',
    or: 'or',
    exit: 'Exit →',
    undo: '↶ Undo last choice',
    winner_label: 'Found it! This is your pick',
    buy_prefix: 'Buy at ',
    keep: 'Keep the winner competing',
    restart: 'Reshuffle and start over',
    winner_fb: 'How was it? Tell us »',
    fab: 'Feedback',
    fb_title: 'How was it?',
    fb_intro: 'We\'d love your feedback to improve — all anonymous.',
    fb_q_ease: 'How easy was it to choose?',
    fb_end_hard: 'Hard', fb_end_easy: 'Very easy',
    fb_q_buy: 'Would you buy this way?',
    fb_buy_yes: 'Yes, exactly', fb_buy_maybe: 'Maybe', fb_buy_no: 'No',
    fb_q_improve: 'What would you improve? <span class="fb-opt">(optional)</span>',
    fb_ph: 'Write to us...',
    fb_submit: 'Send',
    fb_thanks_title: 'Thanks!',
    fb_thanks_sub: 'Your feedback helps us improve.',
    cat_tops: 'Tops', cat_bottoms: 'Bottoms', cat_bodysuits: 'Bodysuits', cat_dresses: 'Dresses', cat_swim: 'Swimwear',
    'color_שחור': 'Black', 'color_לבן': 'White', 'color_אפור': 'Gray', 'color_כחול': 'Blue', 'color_ירוק': 'Green',
    'color_ורוד': 'Pink', 'color_אדום': 'Red', 'color_צהוב': 'Yellow', 'color_כתום': 'Orange', 'color_סגול': 'Purple',
    'color_חום': 'Brown', 'color_מצויר': 'Patterned', 'color_אחר': 'Other',
    err_fewitems: 'Not enough items in this category yet. Try a different choice.',
    err_generic: 'Something went wrong. Try again?',
    store_fallback: 'store'
  }
};

var lang = localStorage.getItem('choosy_lang') || 'he';
function t(key) {
  var d = I18N[lang] || I18N.he;
  if (key in d) return d[key];
  return (key in I18N.he) ? I18N.he[key] : key;
}
function applyI18n() {
  var i, els;
  els = document.querySelectorAll('[data-i18n]');
  for (i = 0; i < els.length; i++) els[i].textContent = t(els[i].getAttribute('data-i18n'));
  els = document.querySelectorAll('[data-i18n-html]');
  for (i = 0; i < els.length; i++) els[i].innerHTML = t(els[i].getAttribute('data-i18n-html'));
  els = document.querySelectorAll('[data-i18n-ph]');
  for (i = 0; i < els.length; i++) els[i].setAttribute('placeholder', t(els[i].getAttribute('data-i18n-ph')));
  document.documentElement.lang = lang;
  document.documentElement.dir = (lang === 'he') ? 'rtl' : 'ltr';
  var tog = document.getElementById('lang-toggle');
  if (tog) tog.textContent = (lang === 'he') ? 'EN' : 'עב';
}
function setLang(l) {
  lang = l;
  try { localStorage.setItem('choosy_lang', l); } catch (e) {}
  applyI18n();
}
document.addEventListener('DOMContentLoaded', function () {
  applyI18n();
  var tog = document.getElementById('lang-toggle');
  if (tog) tog.addEventListener('click', function () {
    setLang(lang === 'he' ? 'en' : 'he');
    if (typeof track === 'function') track('lang_switched', { to: lang });
  });
});
