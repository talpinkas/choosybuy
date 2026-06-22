# Choosy — מדריך ניטור וניתוח ב-Mixpanel

איך לבדוק מה כבר נקלט, איך להקים ניטור של דפוסי שימוש, ואיך לשמור על הפידבקים הכתובים. פרויקט ב-Mixpanel על residency אירופאי (EU), טוקן `d0151b0b7af8502ac4bbed6a650ae33a`.

## האירועים שהמוצר שולח (הסכימה)

כל אירוע נושא `distinct_id` אנונימי (מתחיל ב-`web-`), ולכן אי אפשר לזהות אנשים ב-Mixpanel. את הקישור בין פידבק לאדם עושים דרך שיחות הוואטסאפ והגיליון, לא דרך Mixpanel.

- `setup_started`
- `pool_requested` (gender, age, category)
- `pool_loaded` (count)
- `filters_applied` (colors, budget, result_count)
- `game_started` (product_count, is_restart)
- `comparison_made` (decision_time_ms, comparison_number)
- `game_completed` (winner_name, brand, total_comparisons, time_spent_sec)
- `product_clicked` (product_name, brand, product_url, via)
- `undo`
- `feedback_opened`
- `feedback_submitted` (**ease** 1-5, **would_buy** yes/maybe/no, **comment**, has_comment)
- `lang_switched` (to)

שני ה-KPI של הפיילוט יושבים ב-`feedback_submitted`: `ease` (קלות בחירה) ו-`would_buy` (כוונת קנייה).

## 1. לבדוק מה כבר נקלט

- היכנס ל-Events (או Activity / live view). סנן לפי שמות האירועים למעלה. אתה אמור לראות `setup_started`, `pool_loaded`, `game_started`, `game_completed`, `product_clicked`, `feedback_submitted` וכו', עם חותמות זמן מהימים האחרונים.
- ודא שאלה משתמשים אמיתיים: `distinct_id` שמתחיל ב-`web-`, וזמנים שמתאימים למתי ששלחת לינקים.
- מכיוון שכבר עבדת שם, בדוק קודם אילו Boards/Reports כבר קיימים אצלך, כדי לא לכפול.

## 2. להקים לוח ניטור (Board בשם "Choosy Pilot")

צור Board אחד שמרכז את כל התמונה, עם הדוחות הבאים:

**א. משפך השימוש (Funnel).** השלבים: `setup_started` ← `pool_loaded` ← `game_started` ← `game_completed` ← `product_clicked`. זה מראה איפה אנשים נושרים. שתי הקפיצות הכי חשובות: `game_started` ל-`game_completed` (האם סיימו טורניר) ו-`game_completed` ל-`product_clicked` (האם לחצו לקנות).

**ב. KPI 1, קלות בחירה (Insights).** אירוע `feedback_submitted`, מדד = Average של המאפיין `ease`. הוסף תצוגה שנייה של התפלגות (היסטוגרמה) של `ease` לפי הערכים 1 עד 5, כדי לראות את הפיזור ולא רק את הממוצע.

**ג. KPI 2, כוונת קנייה (Insights).** אירוע `feedback_submitted`, Breakdown לפי `would_buy`. הצג גם כספירה וגם כאחוזים (yes / maybe / no). זה אות כוונת הקנייה.

**ד. מעורבות (Insights).**
- משתמשים ייחודיים שהתחילו: Unique `distinct_id` על `game_started`.
- ממוצע השוואות למשחק: Average של `game_completed.total_comparisons`.
- ממוצע זמן: Average של `game_completed.time_spent_sec`.
- מספר משחקים שהושלמו: Total של `game_completed`.

**ה. נפח פידבק.** Total של `feedback_submitted`, וכמה מתוכם עם `has_comment = true`.

טיפ: קבע לטווח התאריכים של הלוח "since launch" (7 ימים אחרונים), בלי פילוחים נוספים בינתיים, כי הקבוצה קטנה.

## 3. לשמור על הפידבקים הכתובים (comment)

הטקסט החופשי נשמר כמאפיין `comment` על `feedback_submitted` (חתוך ל-500 תווים).

- **לקרוא אותם:** Events view, סנן `event = feedback_submitted`, פתח כל אירוע וראה את `comment`. אפשר גם תצוגת טבלה ב-Insights מקובצת לפי `comment` (זה מאפיין בעל קרדינליות גבוהה, אז עדיף תצוגת Events/Users ולא גרף).
- **לארכב לצמיתות:** ייצא את אירועי `feedback_submitted` ל-CSV (כפתור export בדוח, או Events export). ה-CSV כולל את `comment`. עשה את זה תקופתית (למשל פעם בשבוע), תפיל את הקובץ לתיקיית Choosy, ואני אסכם את הפידבקים לגיליון ואחלץ נושאים חוזרים.
- **חשוב:** לתוכנית החינמית של Mixpanel יש מגבלות שמירה. ייצוא ה-CSV הוא רשת הביטחון שלך כדי שפידבק לא יאבד.

## 4. שגרה

פעם בשבוע: פתח את ה-Board, קרא את שני ה-KPI ואת המשפך, ייצא את ה-CSV של הפידבק, ותעביר לי לקריאה מסוכמת ולעדכון הגיליון. אירוע היומן ביום חמישי והמשימה המתוזמנת יזכירו לך את הסבב הראשון.

## הערה על נתיב הדאטא

חיבור ה-MCP של Mixpanel חסום אצלך (הארגון לא כולל הרשאת MCP), אז הקריאה נעשית דרך הדשבורד או דרך ייצוא CSV שאני מנתח. שתי השיטות עובדות, נתיב ה-CSV חוסך לך עבודה כי אני עושה את הניתוח.
