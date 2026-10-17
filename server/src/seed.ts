// Boshlang'ich ma'lumotlar: taksonomiya, menyu, sozlamalar, administrator va DEMO kontent.
// Barcha namuna materiallar is_demo=1 bilan belgilanadi. Mavzular rasmiy dasturga moslik bo'yicha TASDIQLANMAGAN.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { all, get, run, tx } from './db.js';
import { hashPassword } from './auth.js';
import { writeContent, changeStatus, type Lang } from './content.js';
import { LESSONS, type Blk, type L3 } from './seed-lessons.js';
import { METHODS } from './seed-methods.js';
import { PROJECT_DEFS } from './seed-projects.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const randPw = () => crypto.randomBytes(12).toString('base64url') + '9a';

const SUBJECTS: [string, string, string, string, number][] = [
  ['tabiiy-fan', 'Tabiiy fan', 'Естествознание', 'Natural Science', 1],
  ['matematika', 'Matematika', 'Математика', 'Mathematics', 0], ['fizika', 'Fizika', 'Физика', 'Physics', 0],
  ['kimyo', 'Kimyo', 'Химия', 'Chemistry', 0], ['biologiya', 'Biologiya', 'Биология', 'Biology', 0],
  ['geografiya', 'Geografiya', 'География', 'Geography', 0], ['informatika', 'Informatika va AT', 'Информатика и ИТ', 'Computer Science & IT', 0],
  ['texnologiya', 'Texnologiya', 'Технология', 'Technology', 0], ['tasviriy-sanat', 'Tasviriy san’at', 'Изобразительное искусство', 'Fine Arts', 0],
  ['ona-tili', 'Ona tili va adabiyot', 'Родной язык и литература', 'Native Language & Literature', 0],
  ['ekologiya', 'Ekologik tarbiya va hayotiy ko‘nikmalar', 'Экологическое воспитание и жизненные навыки', 'Ecology & Life Skills', 0],
];

// Namunaviy mavzular — RASMIY DASTUR EMAS (is_verified=0). Haqiqiy mavzularni administrator kiritadi va tasdiqlaydi.
const TOPICS: [number, string, [string, string, string], [string, string, string], number][] = [
  [5, 'suv-aylanishi', ['Suv va havo', 'Вода и воздух', 'Water and air'], ['Suv aylanishi', 'Круговорот воды', 'The water cycle'], 1],
  [5, 'havo-tarkibi', ['Suv va havo', 'Вода и воздух', 'Water and air'], ['Havoning tarkibi', 'Состав воздуха', 'Composition of air'], 2],
  [5, 'quyosh-tizimi', ['Yer va koinot', 'Земля и космос', 'Earth and space'], ['Quyosh tizimi', 'Солнечная система', 'The Solar System'], 3],
  [5, 'moddalar-xossalari', ['Moddalar', 'Вещества', 'Substances'], ['Moddalar va ularning xossalari', 'Вещества и их свойства', 'Substances and their properties'], 4],
  [6, 'fotosintez', ['Tirik tabiat', 'Живая природа', 'Living nature'], ['Fotosintez', 'Фотосинтез', 'Photosynthesis'], 1],
  [6, 'oziq-zanjiri', ['Tirik tabiat', 'Живая природа', 'Living nature'], ['Oziq zanjiri va ekotizim', 'Пищевая цепь и экосистема', 'Food chains and ecosystems'], 2],
  [6, 'agregat-holatlar', ['Moddalar va hodisalar', 'Вещества и явления', 'Matter and phenomena'], ['Moddalarning agregat holatlari', 'Агрегатные состояния вещества', 'States of matter'], 3],
  [6, 'kuchlar-harakat', ['Moddalar va hodisalar', 'Вещества и явления', 'Matter and phenomena'], ['Kuchlar va harakat', 'Силы и движение', 'Forces and motion'], 4],
];

const NAV: { key: string; path: string; icon: string; l: [string, string, string]; children?: { key: string; path: string; l: [string, string, string] }[] }[] = [
  { key: 'home', path: '/', icon: 'home', l: ['Bosh sahifa', 'Главная страница', 'Home'] },
  { key: 'lessons', path: '/lessons', icon: 'book', l: ['Dars ishlanmalari', 'Разработки уроков', 'Lesson Plans'], children: [
    { key: 'lessons-g5', path: '/lessons?grade=5', l: ['5-sinf dars ishlanmalari', 'Разработки уроков 5 класса', 'Grade 5 lesson plans'] },
    { key: 'lessons-g6', path: '/lessons?grade=6', l: ['6-sinf dars ishlanmalari', 'Разработки уроков 6 класса', 'Grade 6 lesson plans'] },
    { key: 'lessons-topics', path: '/topics', l: ['Mavzular bo‘yicha dars ishlanmalari', 'Разработки по темам', 'Lesson plans by topic'] },
    { key: 'lessons-integration', path: '/integration', l: ['Fanlararo integratsiya asosidagi darslar', 'Уроки на основе межпредметной интеграции', 'Interdisciplinary integration lessons'] },
  ] },
  { key: 'methods', path: '/methods', icon: 'users', l: ['Interaktiv metodlar', 'Интерактивные методы', 'Interactive Methods'] },
  { key: 'labs', path: '/labs', icon: 'flask', l: ['Virtual laboratoriyalar', 'Виртуальные лаборатории', 'Virtual Labs'] },
  { key: 'animations', path: '/animations', icon: 'sparkles', l: ['Animatsiyalar', 'Анимации', 'Animations'] },
  { key: 'videos', path: '/videos', icon: 'video', l: ['Video roliklar', 'Видеоролики', 'Videos'] },
  { key: 'ebooks', path: '/ebooks', icon: 'library', l: ['Elektron darsliklar', 'Электронные учебники', 'E-Books'] },
  { key: 'tests', path: '/tests', icon: 'check', l: ['Testlar va topshiriqlar', 'Тесты и задания', 'Tests & Tasks'] },
  { key: 'projects', path: '/projects', icon: 'folder', l: ['Loyiha ishlari', 'Проектные работы', 'Projects'] },
  { key: 'teachers', path: '/teachers', icon: 'school', l: ['O‘qituvchilar uchun', 'Для учителей', 'For Teachers'] },
  { key: 'guides', path: '/guides', icon: 'compass', l: ['Metodik tavsiyalar', 'Методические рекомендации', 'Methodical Guides'] },
  { key: 'search', path: '/search', icon: 'search', l: ['Qidiruv', 'Поиск', 'Search'] },
  { key: 'about', path: '/about', icon: 'info', l: ['Biz haqimizda', 'О платформе', 'About'] },
];

type Section = { key: string; blocks: Blk[] };
const toBlocks = (b: Blk[]): Blk[] => b;
const body = (sections: Section[]) => ({ sections });

export function seed(opts: { adminEmail: string; adminPassword?: string; extraUsers?: boolean }) {
  if ((get('SELECT COUNT(*) n FROM content_items')?.n as number) > 0) { console.log('Ma’lumotlar bazasi allaqachon to‘ldirilgan. Qayta to‘ldirish uchun data/app.db ni o‘chiring.'); return null; }
  const out: { admin?: { email: string; password: string }; extra: { email: string; role: string; password: string }[] } = { extra: [] };
  tx(() => {
    for (const g of [[5, '5-sinf', '5 класс', 'Grade 5'], [6, '6-sinf', '6 класс', 'Grade 6']] as const) run('INSERT OR IGNORE INTO grades(id,name_uz,name_ru,name_en) VALUES(?,?,?,?)', ...g);
    for (const s of SUBJECTS) run('INSERT OR IGNORE INTO subjects(slug,name_uz,name_ru,name_en,is_core,sort_order) VALUES(?,?,?,?,?,?)', s[0], s[1], s[2], s[3], s[4], SUBJECTS.indexOf(s));
    for (const t of TOPICS) run('INSERT OR IGNORE INTO topics(grade_id,slug,section_uz,section_ru,section_en,title_uz,title_ru,title_en,sort_order,is_verified) VALUES(?,?,?,?,?,?,?,?,?,0)', t[0], t[1], t[2][0], t[2][1], t[2][2], t[3][0], t[3][1], t[3][2], t[4]);
    NAV.forEach((n, i) => {
      const r = run('INSERT INTO nav_items(key,path,icon,label_uz,label_ru,label_en,sort_order) VALUES(?,?,?,?,?,?,?)', n.key, n.path, n.icon, ...n.l, i);
      n.children?.forEach((c, j) => run('INSERT INTO nav_items(parent_id,key,path,label_uz,label_ru,label_en,sort_order) VALUES(?,?,?,?,?,?,?)', Number(r.lastInsertRowid), c.key, c.path, ...c.l, j));
    });
    const S: Record<string, string> = {
      site_name_uz: 'Tabiiy fan — Science', site_name_ru: 'Естествознание — Science', site_name_en: 'Natural Science — Science',
      tagline_uz: 'Tabiiy fanlarni integratsiya asosida o‘qitamiz', tagline_ru: 'Преподаём естествознание на основе интеграции', tagline_en: 'Teaching natural science through integration',
      default_lang: 'uz', demo_banner: '1', contact_email: '', studio_allowed_hosts: '', home_config: '{}',
    };
    for (const [k, v] of Object.entries(S)) run('INSERT OR IGNORE INTO platform_settings(key,value) VALUES(?,?)', k, v);

    const adminPw = opts.adminPassword ?? randPw();
    const r = run('INSERT INTO users(email,password_hash,full_name,role_id) VALUES(?,?,?,(SELECT id FROM roles WHERE key=?))', opts.adminEmail, hashPassword(adminPw), 'Super administrator', 'super_admin');
    out.admin = { email: opts.adminEmail, password: opts.adminPassword ? '(sizning ADMIN_PASSWORD)' : adminPw };
    if (opts.extraUsers) for (const [email, name, role] of [['editor@tabiiy-fan.local', 'Metodist (namuna)', 'republic_editor'], ['teacher@tabiiy-fan.local', 'O‘qituvchi (namuna)', 'teacher']] as const) {
      const pw = randPw(); run('INSERT INTO users(email,password_hash,full_name,role_id) VALUES(?,?,?,(SELECT id FROM roles WHERE key=?))', email, hashPassword(pw), name, role); out.extra.push({ email, role, password: pw });
    }
    void r;
  });
  const admin = get('SELECT id FROM users WHERE email=?', opts.adminEmail)!.id as number;
  const sid = (slug: string) => get('SELECT id FROM subjects WHERE slug=?', slug)!.id as number;
  const tid = (slug: string) => get('SELECT id FROM topics WHERE slug=?', slug)!.id as number;
  const tr3 = (title: L3, summary: L3, keywords: L3, bodyJson: unknown, trStatus: Record<Lang, string>) => Object.fromEntries((['uz', 'ru', 'en'] as Lang[]).map(l => [l, {
    title: title[l], summary: summary[l], keywords: keywords[l], body: l === 'uz' ? bodyJson : undefined, status: trStatus[l] }])) as any;
  const trStatus = { uz: 'final', ru: 'draft', en: 'draft' } as Record<Lang, string>;
  const setSlug = (id: number, slug: string) => run('UPDATE content_items SET slug=? WHERE id=?', slug, id);

  // --- interaktiv loyihalar (HTML Studio) ---
  const projectIds: Record<string, number> = {};
  for (const def of PROJECT_DEFS) {
    const dir = path.resolve(here, '../seed-assets', def.dir);
    const rd = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8');
    const html = rd('index.html'), css = rd('style.css'), js = rd('app.js');
    const r = run('INSERT INTO interactive_projects(name,html,css,js,mode,status,is_demo,author_id) VALUES(?,?,?,?,?,?,1,?)', def.name, html, css, js, 'code', 'published', admin);
    const pid = Number(r.lastInsertRowid);
    run('INSERT INTO project_versions(project_id,version_no,html,css,js,kind,note,author_id) VALUES(?,?,?,?,?,?,?,?)', pid, 1, html, css, js, 'manual', 'namuna yaratildi', admin);
    const v = run('INSERT INTO project_versions(project_id,version_no,html,css,js,kind,note,author_id) VALUES(?,?,?,?,?,?,?,?)', pid, 2, html, css, js, 'published', 'nashr', admin);
    run('UPDATE interactive_projects SET published_version_id=? WHERE id=?', Number(v.lastInsertRowid), pid);
    projectIds[def.dir] = pid;
  }

  // --- metodlar ---
  const methodIds: Record<string, number> = {};
  for (const m of METHODS) {
    const sections: Section[] = [
      { key: 'purpose', blocks: [m.purpose] }, { key: 'applicability', blocks: [m.applicability] }, { key: 'steps', blocks: [{ ol: m.steps }] },
      { key: 'materials', blocks: [m.materials] }, { key: 'timing', blocks: [{ table: { head: ['', 'min'], rows: m.timing.map(t => [t.step, String(t.min)]) } }] },
      { key: 'student', blocks: [m.student] }, { key: 'teacher', blocks: [m.teacher] }, { key: 'assessment', blocks: [m.assessment] },
    ];
    const id = writeContent(null, { kind: 'method', grade: m.grade, format: 'html', isDemo: true, subjectIds: m.subjects.map(sid), translations: tr3(m.title, m.summary, { uz: '', ru: '', en: '' }, body(sections), trStatus) }, admin);
    setSlug(id, m.slug); methodIds[m.slug] = id;
    changeStatus(id, 'in_review', admin, 'Namuna'); changeStatus(id, 'approved', admin, 'Namuna'); changeStatus(id, 'published', admin, 'Namuna');
  }

  // --- dars ishlanmalari ---
  const SEC_ORDER = Array.from({ length: 20 }, (_, i) => 's' + (i + 1));
  for (const l of LESSONS) {
    const sections: Section[] = SEC_ORDER.filter(k => l.s[k]).map(k => ({ key: k, blocks: toBlocks(l.s[k]) }));
    const id = writeContent(null, {
      kind: 'lesson', grade: l.grade, topicId: tid(l.topic), lessonType: l.lessonType, durationMin: l.duration, format: 'html', isDemo: true,
      subjectIds: l.subjects.map(sid), methodIds: l.methods.map(m => methodIds[m]).filter(Boolean),
      interactiveProjectId: l.project ? projectIds[l.project] : null,
      translations: tr3(l.title, l.summary, l.keywords, body(sections), trStatus),
    }, admin);
    setSlug(id, l.slug);
    if (l.status === 'in_review') changeStatus(id, 'in_review', admin, 'Namuna: moderatsiya jarayonini ko‘rsatish uchun');
    else { changeStatus(id, 'in_review', admin); changeStatus(id, 'approved', admin); changeStatus(id, 'published', admin); }
  }

  // --- laboratoriya, animatsiyalar, topshiriq ---
  const pub = (id: number) => { changeStatus(id, 'in_review', admin); changeStatus(id, 'approved', admin); changeStatus(id, 'published', admin); };
  const simple = (kind: 'lab' | 'animation' | 'assessment', slug: string, grade: 5 | 6 | null, project: string, title: L3, summary: L3, subjects: string[], topic: string | null, sections: Section[]) => {
    const id = writeContent(null, { kind, grade, topicId: topic ? tid(topic) : null, format: 'html', isDemo: true, subjectIds: subjects.map(sid), interactiveProjectId: projectIds[project],
      translations: tr3(title, summary, { uz: '', ru: '', en: '' }, body(sections), trStatus) }, admin);
    setSlug(id, slug); pub(id); return id;
  };
  simple('animation', 'suv-aylanishi-animatsiyasi', 5, 'water-cycle',
    { uz: 'Suv aylanishi — interaktiv animatsiya', ru: 'Круговорот воды — интерактивная анимация', en: 'The water cycle — interactive animation' },
    { uz: 'Quyosh issiqligini o‘zgartirib, bug‘lanish, kondensatsiya, yog‘in va oqimni kuzating.', ru: 'Меняя тепло Солнца, наблюдайте испарение, конденсацию, осадки и сток.', en: 'Change the Sun’s heat and watch evaporation, condensation, precipitation and runoff.' },
    ['tabiiy-fan', 'geografiya'], 'suv-aylanishi',
    [{ key: 'goal', blocks: ['Suv aylanishining to‘rt bosqichini ko‘rish va Quyosh issiqligining rolini kuzatish.'] }, { key: 'howto', blocks: [['Slayder bilan Quyosh issiqligini o‘zgartiring.', 'Bosqich tugmalarini bosib izohni o‘qing.']] }, { key: 'limits', blocks: ['Soddalashtirilgan model; haqiqiy jarayon murakkabroq.'] }]);
  simple('animation', 'quyosh-tizimi-animatsiyasi', 5, 'solar-system',
    { uz: 'Quyosh tizimi — sayyoralar orbitasi', ru: 'Солнечная система — орбиты планет', en: 'The Solar System — planetary orbits' },
    { uz: 'Sakkizta sayyorani tanlang, tartibi va Quyoshdan masofasini (a.b.) bilib oling. Masshtab saqlanmagan.', ru: 'Выберите одну из восьми планет и узнайте порядок и расстояние до Солнца (а.е.). Масштаб не соблюдён.', en: 'Pick one of the eight planets to see its order and distance from the Sun (AU). Not to scale.' },
    ['tabiiy-fan', 'informatika', 'tasviriy-sanat'], 'quyosh-tizimi',
    [{ key: 'goal', blocks: ['Sayyoralar tartibini va ularning nisbiy joylashuvini ko‘rish.'] }, { key: 'limits', blocks: ['Orbitalar va o‘lchamlar masshtabga mos EMAS.'] }]);
  simple('lab', 'agregat-holatlar-laboratoriyasi', 6, 'states-of-matter',
    { uz: 'Virtual laboratoriya: moddaning agregat holatlari', ru: 'Виртуальная лаборатория: агрегатные состояния вещества', en: 'Virtual lab: states of matter' },
    { uz: 'Haroratni o‘zgartirib, suv zarralari qanday harakatlanishini va holat qachon o‘zgarishini kuzating.', ru: 'Меняя температуру, наблюдайте движение частиц воды и смену состояния.', en: 'Change the temperature and watch how water particles move and when the state changes.' },
    ['tabiiy-fan', 'fizika', 'kimyo'], 'agregat-holatlar',
    [{ key: 'goal', blocks: ['Qattiq, suyuq va gaz holatlarida zarralar harakatini taqqoslash.'] }, { key: 'howto', blocks: [['Haroratni -20 dan 120 °C gacha o‘zgartiring.', '0 °C va 100 °C atrofida holat o‘zgarishini kuzating.']] }, { key: 'limits', blocks: ['Soddalashtirilgan zarra modeli; real jarayon uzluksiz va murakkab.'] }]);
  simple('assessment', 'fanlararo-moslashtirish-topshirigi', 5, 'match-subjects',
    { uz: 'Topshiriq: suv aylanishida fanlararo bog‘lanish', ru: 'Задание: межпредметные связи в круговороте воды', en: 'Task: cross-subject links in the water cycle' },
    { uz: 'Faoliyatlarni tegishli fan maydoniga sudrab joylang (sichqonchasiz ham ishlaydi).', ru: 'Перетащите действия в нужную область предмета (работает и без мыши).', en: 'Drag activities into the matching subject area (works without a mouse too).' },
    ['tabiiy-fan', 'matematika', 'geografiya', 'biologiya', 'informatika'], 'suv-aylanishi',
    [{ key: 'goal', blocks: ['Bir mavzu bir nechta fanni qanday bog‘lashini muhokama qilish.'] }]);

  // --- test (serverda tekshiriladi) ---
  const tid2 = writeContent(null, { kind: 'assessment', grade: 5, topicId: tid('suv-aylanishi'), format: 'html', isDemo: true, subjectIds: [sid('tabiiy-fan'), sid('geografiya')],
    translations: tr3({ uz: 'Suv aylanishi bo‘yicha qisqa test', ru: 'Короткий тест по круговороту воды', en: 'Short quiz on the water cycle' },
      { uz: '5 ta savol; javoblar serverda tekshiriladi.', ru: '5 вопросов; ответы проверяются на сервере.', en: '5 questions; answers are checked on the server.' }, { uz: '', ru: '', en: '' }, body([{ key: 'goal', blocks: ['Suv aylanishi bosqichlarini tekshirish.'] }]), trStatus) }, admin);
  setSlug(tid2, 'suv-aylanishi-testi'); pub(tid2);
  const QS: { q: L3; o: L3[]; c: number; e: L3 }[] = [
    { q: { uz: 'Suvning suv bug‘iga aylanishi nima deyiladi?', ru: 'Как называется превращение воды в водяной пар?', en: 'What is the change of water into water vapour called?' },
      o: [{ uz: 'Bug‘lanish', ru: 'Испарение', en: 'Evaporation' }, { uz: 'Muzlash', ru: 'Замерзание', en: 'Freezing' }, { uz: 'Erish', ru: 'Плавление', en: 'Melting' }], c: 0,
      e: { uz: 'Suyuq suvning bug‘ga aylanishi bug‘lanish deyiladi.', ru: 'Превращение жидкой воды в пар называется испарением.', en: 'Liquid water turning into vapour is called evaporation.' } },
    { q: { uz: 'Bulutlar qanday hosil bo‘ladi?', ru: 'Как образуются облака?', en: 'How do clouds form?' },
      o: [{ uz: 'Suv bug‘i sovib, mayda tomchilarga aylanadi', ru: 'Водяной пар остывает и превращается в мелкие капли', en: 'Water vapour cools into tiny droplets' }, { uz: 'Shamol yerdan chang ko‘taradi', ru: 'Ветер поднимает пыль с земли', en: 'Wind lifts dust from the ground' }, { uz: 'Quyosh nuri to‘planadi', ru: 'Собирается солнечный свет', en: 'Sunlight gathers' }], c: 0,
      e: { uz: 'Kondensatsiya natijasida bulut tomchilari hosil bo‘ladi.', ru: 'Капли облака образуются в результате конденсации.', en: 'Cloud droplets form through condensation.' } },
    { q: { uz: 'Suv aylanishini asosan qaysi energiya manbai harakatlantiradi?', ru: 'Какой источник энергии в основном приводит в движение круговорот воды?', en: 'Which energy source mainly drives the water cycle?' },
      o: [{ uz: 'Quyosh', ru: 'Солнце', en: 'The Sun' }, { uz: 'Oy', ru: 'Луна', en: 'The Moon' }, { uz: 'Shamol turbinalari', ru: 'Ветряные турбины', en: 'Wind turbines' }], c: 0,
      e: { uz: 'Quyosh issiqligi suvni bug‘lantiradi va jarayonni boshlaydi.', ru: 'Тепло Солнца испаряет воду и запускает процесс.', en: 'The Sun’s heat evaporates water and starts the process.' } },
    { q: { uz: 'Yer yuzasining taxminan qancha qismini suv egallaydi?', ru: 'Какую примерно часть поверхности Земли занимает вода?', en: 'Roughly how much of Earth’s surface is covered by water?' },
      o: [{ uz: 'Taxminan 10%', ru: 'Около 10%', en: 'About 10%' }, { uz: 'Taxminan 71%', ru: 'Около 71%', en: 'About 71%' }, { uz: 'Taxminan 99%', ru: 'Около 99%', en: 'About 99%' }], c: 1,
      e: { uz: 'Yer yuzasining taxminan 71% qismi suv bilan qoplangan.', ru: 'Около 71% поверхности Земли покрыто водой.', en: 'About 71% of Earth’s surface is covered by water.' } },
    { q: { uz: 'Yomg‘ir suvi yerga tushgach nima sodir bo‘ladi?', ru: 'Что происходит с дождевой водой после падения на землю?', en: 'What happens to rain water after it reaches the ground?' },
      o: [{ uz: 'U daryolar orqali oqib, yer ostiga singib, yana dengizga yetib boradi', ru: 'Стекает по рекам, просачивается в почву и снова попадает в море', en: 'It flows along rivers, seeps underground and reaches the sea again' }, { uz: 'U butunlay yo‘qoladi', ru: 'Полностью исчезает', en: 'It disappears completely' }, { uz: 'U faqat muzga aylanadi', ru: 'Превращается только в лёд', en: 'It only turns into ice' }], c: 0,
      e: { uz: 'Suv yo‘qolmaydi — aylanishda davom etadi.', ru: 'Вода не исчезает — она продолжает круговорот.', en: 'Water does not vanish — it keeps cycling.' } },
  ];
  run('INSERT INTO assessments(content_id,pass_percent) VALUES(?,60)', tid2);
  const aid = get('SELECT id FROM assessments WHERE content_id=?', tid2)!.id as number;
  QS.forEach((q, i) => run('INSERT INTO questions(assessment_id,sort_order,q_uz,q_ru,q_en,options,correct_index,explanation_uz,explanation_ru,explanation_en) VALUES(?,?,?,?,?,?,?,?,?,?)',
    aid, i, q.q.uz, q.q.ru, q.q.en, JSON.stringify(q.o), q.c, q.e.uz, q.e.ru, q.e.en));

  // --- loyiha ishlari (g'oyalar) ---
  const proj = (slug: string, grade: 5 | 6, title: L3, summary: L3, subjects: string[], topic: string, secs: Section[]) => {
    const id = writeContent(null, { kind: 'project', grade, topicId: tid(topic), format: 'html', isDemo: true, subjectIds: subjects.map(sid), translations: tr3(title, summary, { uz: '', ru: '', en: '' }, body(secs), trStatus) }, admin);
    setSlug(id, slug); pub(id);
  };
  proj('maktab-suv-sarfi', 5, { uz: 'Maktabimizda suv sarfini o‘lchaymiz', ru: 'Измеряем расход воды в нашей школе', en: 'Measuring water use in our school' },
    { uz: 'Matematika va ekologiyani bog‘lovchi guruh loyihasi (g‘oya).', ru: 'Групповой проект, связывающий математику и экологию (идея).', en: 'A group project linking maths and ecology (idea).' }, ['tabiiy-fan', 'matematika', 'ekologiya'], 'suv-aylanishi',
    [{ key: 'goal', blocks: ['Maktab ichida suvdan foydalanishni kuzatish va tejash yo‘llarini taklif qilish.'] }, { key: 'stages', blocks: [{ ol: ['Kuzatish joylarini tanlash (maktab ruxsati bilan).', 'Bir hafta davomida kuzatuv jadvalini yuritish.', 'Ma’lumotni diagrammaga aylantirish.', 'Tejash bo‘yicha 3 ta taklif tayyorlash.', 'Sinfda taqdimot.'] }] }, { key: 'outcomes', blocks: ['Jadval, diagramma va taklifnomalar.'] }, { key: 'assessment', blocks: ['Reja, ma’lumot to‘g‘riligi, taqdimot va hamkorlik bo‘yicha mezonlar.'] }]);
  proj('maktab-hovlisi-harorat', 6, { uz: 'Maktab hovlisida harorat kuzatuvi', ru: 'Наблюдение за температурой на школьном дворе', en: 'Temperature observation in the school yard' },
    { uz: 'Matematika, informatika va geografiyani bog‘lovchi loyiha (g‘oya).', ru: 'Проект, объединяющий математику, информатику и географию (идея).', en: 'A project linking maths, computer science and geography (idea).' }, ['tabiiy-fan', 'matematika', 'informatika', 'geografiya'], 'agregat-holatlar',
    [{ key: 'goal', blocks: ['Hovlining turli joylarida (quyoshda va soyada) haroratni o‘lchab, taqqoslash.'] }, { key: 'stages', blocks: [{ ol: ['Kuzatuv nuqtalari va vaqtlarini belgilash.', 'Termometr bilan o‘lchash (xavfsizlik qoidalariga rioya qilib).', 'Elektron jadvalda grafik tuzish.', 'Xulosa yozish.'] }] }, { key: 'outcomes', blocks: ['Grafik va qisqa hisobot.'] }, { key: 'assessment', blocks: ['O‘lchash aniqligi, grafik, xulosa.'] }]);

  // --- e'lonlar (DEMO) ---
  run("INSERT INTO announcements(title_uz,title_ru,title_en,body_uz,body_ru,body_en,status,is_demo,author_id,published_at) VALUES(?,?,?,?,?,?,'published',1,?,datetime('now'))",
    'Platformaning birinchi (namunaviy) versiyasi ishga tushdi', 'Запущена первая (демонстрационная) версия платформы', 'The first (demo) version of the platform is live',
    'Bu e’lon namuna (demo) hisoblanadi. Haqiqiy e’lonlarni administrator panelidan qo‘shing.', 'Это демонстрационное объявление. Реальные объявления добавляйте через панель администратора.', 'This is a demo announcement. Add real announcements from the admin panel.', admin);

  return out;
}

// CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const email = process.env.ADMIN_EMAIL ?? 'admin@tabiiy-fan.local';
  const res = seed({ adminEmail: email, adminPassword: process.env.ADMIN_PASSWORD, extraUsers: process.env.SEED_EXTRA_USERS === '1' });
  if (res) {
    console.log('\nSeed yakunlandi.');
    console.log(`Super administrator: ${res.admin!.email}  |  parol: ${res.admin!.password}`);
    for (const u of res.extra) console.log(`${u.role}: ${u.email}  |  parol: ${u.password}`);
    console.log('Parolni darhol saqlab qo‘ying va kirgach almashtiring — u boshqa ko‘rsatilmaydi.\n');
  }
  void all;
}
