import type { AudienceId, County, Tag } from "./types";
import { NEEDS_FITTING, TASKS, TOOL_NOTES, UNSURE } from "./finder";

export const CATEGORIES = ["Kõik", "Söömine ja riietumine", "Käed ja kirjutamine", "Päevakava ja rahu", "Asutuste komplektid"] as const;
type Category = (typeof CATEGORIES)[number];

export type Art = "pencil" | "scissors" | "spoon" | "jar" | "mat" | "lace" | "plan" | "timer" | "home" | "cards";
export interface Product {
  id: string;
  name: string;
  category: Exclude<Category, "Kõik">;
  art: Art;
  cents: number;
  reason: string;
  digital: boolean;
  featured: boolean;
  caution: string;
  safety: string;
  reviewer: string;
  variantId?: string;
}

const featured = [
  ["Jäme pliiats", 490, "pencil", 2, "Kolmnurksest jämedast korpusest on lihtne kinni võtta.", "Väikestele lastele täiskasvanu järelevalve all."],
  ["Käärid, mis avanevad ise", 1290, "scissors", 2, "Vedru avab käärid pärast iga lõiget.", "Lõikamist tuleb harjutada täiskasvanu juuresolekul."],
  ["Jämeda varrega lusikas", 1490, "spoon", 1, "Jäme vars annab käele suurema haardepinna.", "Kui neelamine on raske, küsige sobiva söögivahendi kohta nõu."],
  ["Purgiavaja", 990, "jar", 1, "Lai käepide annab purgikaane keeramisel suurema haardepinna.", "Valige avaja vastavalt kaane mõõdule."],
  ["Libisemiskindel lauamatt", 1190, "mat", 1, "Matt aitab taldrikul kuival laual paigal püsida.", "Matt on mõeldud lauale. Põrandal võib see põhjustada komistamist."],
  ["Elastsed kingapaelad", 850, "lace", 1, "Paelad venivad ja seotakse paika esimesel kasutamisel.", "Proovige paelu kõndides ja jälgige, et jalanõu püsiks kindlalt jalas."],
  ["Piltidega päevakava", 690, "plan", 3, "Prinditavad pildid aitavad päeva tegevused järjekorda panna.", "Kui pildid jäävad ebaselgeks, proovige koos lapse või lähedasega fotosid."],
  ["Liivakell", 790, "timer", 3, "Liiv näitab aja kulgu ilma numbri ja helita.", "Hoidke klaasist vahendit väikelaste eest."],
  ["Kodu ülevaatuse leht", 290, "home", 4, "Prinditavale lehele saab kirja panna kohad, mida koos üle vaadata.", "Kukkumisohu ja abivahendite sobivust hinnake koos terapeudiga."],
  ["Tegevuste harjutuskaardid", 1890, "cards", 4, "Prinditavad kaardid jagavad igapäevase tegevuse nähtavateks sammudeks.", "Kohandage samme koos inimesega, kes neid kasutab."],
] as const;

const exactNames = [...new Set([...TASKS.flatMap((task) => task.tools), ...UNSURE.tools])].filter((name) => !NEEDS_FITTING.has(name));
const slug = (value: string): string => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "");
const artwork = (name: string): Art => {
  if (/pliiats|lõikam/i.test(name)) return "pencil";
  if (/leht|mõõtmi|ülevaat|küsimus/i.test(name)) return "home";
  if (/kaart|juhis|silt|nimekiri/i.test(name)) return "cards";
  if (/söök|lusik|köögi|taldrik|tass/i.test(name)) return "spoon";
  if (/riie|luku|soki|pael|kinga|käsn/i.test(name)) return "lace";
  if (/alus|matt|sirm/i.test(name)) return "mat";
  if (/taimer|kell|lamp/i.test(name)) return "timer";
  return "plan";
};

const factualNotes: Readonly<Record<string, string>> = {
  "Pliiatsihoidik": "Pliiatsi peale asetatav hoidik annab sõrmedele laiema toetuspinna.",
  "Suur luku tõmbeaas": "Luku külge lisatav aas teeb tõmbekohast suurema.",
  "Paelte sidumise harjutuskaart": "Kaardil on paelte sidumise sammud piltidena.",
  "Kõrgema servaga taldrik": "Kõrgemast servast saab lusikale tõstes tuge.",
  "Pildikaart pausi küsimiseks": "Pausisoovi saab näidata pildiga.",
  "Lauasirm": "Sirm eraldab laual väiksema töökoha.",
  "Mürasummutavad kõrvaklapid": "Kõrvaklapid vähendavad ümbritsevat heli.",
  "Kahe pildiga kaart „Kõigepealt ja siis”": "Kaks pilti näitavad praegust ja järgmist tegevust.",
  "Libisemiskindel alus": "Alus aitab esemeid kuival tööpinnal paigal hoida.",
  "Jämeda käepidemega köögivahend": "Jäme käepide annab sõrmedele laiema haardepinna.",
  "Pika varrega pesukäsn": "Pikk vars ulatub kaugemale kui käes hoitav käsn.",
  "Libisemiskindel matt": "Matti saab kasutada eseme all kuival tööpinnal.",
  "Tööpäeva plaan ühel lehel": "Lehel on koht tööülesannete ja pauside kirjapanekuks.",
  "Jalgealune": "Istudes saab toetada jalad alusele.",
  "Pauside meeldetuletus": "Meeldetuletusele saab märkida pauside ajad.",
  "Tahvel meeldetuletusteks": "Tahvlile saab kirjutada järgmised tegevused.",
  "Lihtne taimer": "Taimer näitab, kui palju aega on jäänud.",
  "Vannitoa ülevaatuse leht": "Lehele saab märkida küsimused vannitoa kasutamise kohta.",
  "Istekõrguse mõõtmise leht": "Lehele saab kirja panna tooli ja istme mõõdud.",
  "Kaanega tass": "Kaas katab tassi ava.",
  "Piltidega juhis": "Pildid näitavad ühe tegevuse samme järjekorras.",
  "Voodi ja tooli kõrguse mõõtmise leht": "Lehele saab kirjutada mõlema pinna kõrguse.",
  "Küsimuste leht kodukülastuseks": "Lehele saab enne terapeudi külastust küsimused kirja panna.",
  "Nimekiri riiete valmispanekuks": "Nimekirja abil saab vajalikud riided valmis panna.",
  "Küsimuste leht vahendi proovimiseks": "Lehele saab märkida, millise tegevuse juures vahendit proovida.",
  "Suure kirjaga kell": "Suured numbrid aitavad kellaaega kaugemalt näha.",
  "Tegevuste nimekiri": "Tegevused saab üles märkida ja tehtud sammud ära tähistada.",
  "Lõikamise harjutusleht": "Lehel on eri kujuga lõikejooned.",
  "Ruumi ülevaatuse leht": "Lehele saab märkida liikumisteed ja asjade asukohad.",
  "Suure kirjaga uksesildid": "Sildid näitavad ruumi nime suure kirjaga.",
  "Sahtlisildid": "Silt aitab näha, mis sahtlis on.",
  "Suure kirjaga juhised": "Tegevuse sammud on kirjas suure kirjaga.",
  "Leht, kuhu märkida, mis on raske": "Lehele saab kirja panna ühe toimingu, milles soovite abi.",
};

export const PRODUCTS: Product[] = exactNames.map((name) => {
  const item = featured.find(([title]) => title === name);
  const art = item?.[2] ?? artwork(name);
  const digital = /leht|plaan|päevakava|kaart|juhis|silt|nimekiri|meeldetuletus/i.test(name);
  const category = CATEGORIES[item?.[3] ?? (["spoon","lace","jar","mat"].includes(art) ? 1 : art === "pencil" ? 2 : art === "home" ? 4 : 3)];
  return {
    id: slug(name), name, category, art,
    cents: item?.[1] ?? (digital ? 290 : 1290), digital, featured: Boolean(item),
    reason: item?.[4] ?? factualNotes[name] ?? TOOL_NOTES[name] ?? "Vahendi omadusi saab vaadata toote lehelt.",
    caution: item?.[5] ?? (digital ? "Kui pakutud sammud ei sobi, kohandage lehte koos terapeudiga." : "Proovige enne ostu. Vaadake, kas vahendi mõõt ja kasutusviis teile sobivad."),
    safety: digital ? "Digitaalne PDF. Tootemärgistus CE ja mänguasja standard EN 71 ei kohaldu."
      : "GPSR toote- ja tootjainfo, hoiatused ning CE ja EN 71 kohaldumine kinnitatakse enne päris müüki.",
    reviewer: "Kadri Tamm, tegevusterapeut (näidis)",
  };
}).sort((a, b) => featured.findIndex(([name]) => name === a.name) - featured.findIndex(([name]) => name === b.name));

export const TRAINING_AUDIENCES = ["Kõik", "Lasteaiad ja koolid", "Hooldekodud", "Omastehooldajad", "Spetsialistid"] as const;
export type TrainingAudience = (typeof TRAINING_AUDIENCES)[number];

export interface Course {
  id: string;
  title: string;
  short: string;
  compact?: string;
  date: string;
  time: string;
  place: string;
  county?: County;
  audience: Exclude<TrainingAudience, "Kõik">;
  eligible: AudienceId[];
  tags: Tag[];
  hours: number;
  cents: number;
  ehis: string;
  seats: number;
  teacher: string;
  description: string;
}

export const COURSES: Course[] = [
  { id: "kirjutamine", title: "Kuidas last kirjutamisel toetada", short: "Kirjutamine", compact: "Pliiats", date: "2026-12-04", time: "10.00–15.30", place: "Tartu, Riia 18", county: "Tartumaa", audience: "Lasteaiad ja koolid", eligible: ["laps", "asutus"], tags: ["kirjutamine"], hours: 6, cents: 8900, ehis: "Õppekava 45218 (näidis)", seats: 7, teacher: "Riin Saar", description: "Proovime, kuidas lastega pliiatsi hoidmist ja kääridega lõikamist harjutada." },
  { id: "kodus", title: "Kuidas kodus igapäevastes asjades aidata", short: "Abi kodus", compact: "Koduabi", date: "2026-12-08", time: "17.30–19.00", place: "Veebis", audience: "Omastehooldajad", eligible: ["hooldaja", "eakas"], tags: ["riietumine", "pesemine", "soomine", "kodu", "siirdumine", "abivahendid", "paevakava"], hours: 2, cents: 0, ehis: "Avalik loeng", seats: 31, teacher: "Marju Kask", description: "Vaatame, milliseid samme saab lähedane süües, pestes ja riietudes ise teha." },
  { id: "larm", title: "Kuidas last lärmakas rühmas toetada", short: "Rahulik rühm", compact: "Rühm", date: "2026-12-10", time: "09.30–14.00", place: "Tallinn, Tartu mnt 52", county: "Harjumaa", audience: "Lasteaiad ja koolid", eligible: ["laps", "asutus"], tags: ["sensoorne", "ruumid"], hours: 5, cents: 7900, ehis: "Õppekava 45223 (näidis)", seats: 5, teacher: "Martin Kuusk", description: "Proovime pildikaarte ja vaatame, kuhu teha rühmaruumis vaiksem koht." },
  { id: "hooldekodu", title: "Söömine ja riietumine hooldekodus", short: "Söömine ja riietumine", compact: "Söök", date: "2026-12-15", time: "10.00–16.00", place: "Pärnu, Rüütli 40", county: "Pärnumaa", audience: "Hooldekodud", eligible: ["asutus", "hooldaja"], tags: ["soomine", "riietumine", "tootajad", "pesemine"], hours: 7, cents: 9500, ehis: "Õppekava 45231 (näidis)", seats: 9, teacher: "Liis Rebane", description: "Harjutame, kuidas jätta söömisel ja riietumisel elanikule aega ise kaasa teha." },
  { id: "ruum", title: "Igapäevatoimingute hindamine kodus", short: "Kodu hindamine", compact: "Kodu", date: "2026-12-17", time: "10.00–16.30", place: "Rakvere, Pikk 7", county: "Lääne-Virumaa", audience: "Spetsialistid", eligible: ["asutus"], tags: ["ruumid", "kukkumine", "kodu"], hours: 8, cents: 14500, ehis: "Õppekava 45242 (näidis)", seats: 10, teacher: "Anu Sepp", description: "Vaatame läbi eluruumi plaani ja paneme kirja, mida kodukülastusel jälgida." },
  { id: "mang", title: "Kuidas aidata lapsel järgmise tegevuse juurde minna", short: "Tegevuse vahetus", compact: "Päev", date: "2027-01-14", time: "18.00–19.30", place: "Narva, Puškini 21", county: "Ida-Virumaa", audience: "Lasteaiad ja koolid", eligible: ["laps", "asutus"], tags: ["uleminekud", "paevakava"], hours: 2, cents: 1500, ehis: "Avalik õpituba", seats: 11, teacher: "Jelena Ivanova", description: "Teeme piltidega päevakava ja harjutame kahe pildiga kaardi kasutamist." },
  { id: "too", title: "Kuidas tööpäeva pärast haigust kohandada", short: "Tööle naasmine", compact: "Töö", date: "2027-01-21", time: "13.00–15.00", place: "Veebis", audience: "Spetsialistid", eligible: ["ise", "asutus"], tags: ["too", "paevakava"], hours: 3, cents: 3500, ehis: "Õppekava 45403 (näidis)", seats: 42, teacher: "Tõnu Mägi", description: "Vaatame, kuidas saab tööpäeva ja tööülesandeid muuta." },
  { id: "kodu2027", title: "Kodu ülevaatus pärast haiglast tulekut", short: "Kodu ülevaatus", compact: "Kodu", date: "2027-01-27", time: "17.30–19.00", place: "Veebis", audience: "Omastehooldajad", eligible: ["hooldaja", "eakas"], tags: ["kodu", "kukkumine", "siirdumine"], hours: 2, cents: 2500, ehis: "Avalik õpituba", seats: 8, teacher: "Kristiina Lepp", description: "Paneme kokku küsimused, mida koos lähedase ja terapeudiga kodus läbi vaadata." },
];
