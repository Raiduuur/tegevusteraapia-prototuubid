import type { AudienceId, Tag } from "./types";

/**
 * Public editorial dataset for the finder.
 *
 * Every visitor loads exactly this file whatever they answer: choices, result
 * sentences, tool examples and task tags. Answers are matched against it in
 * memory only (views/finder.ts) and never reach a URL, storage, history or a
 * request. Copy follows plain-language-ux-research.md word for word; the task
 * phrases are editorial hypotheses awaiting field interviews.
 */

export interface Audience {
  id: AudienceId;
  label: string;
  hint: string;
}

export const AUDIENCES: readonly Audience[] = [
  { id: "laps", label: "Lapsele", hint: "Teie laps, lapselaps või hoolealune" },
  { id: "ise", label: "Endale", hint: "Ka siis, kui olete eakas ja otsite abi iseendale" },
  { id: "eakas", label: "Eakale lähedasele", hint: "Teie ema, isa, vanaema või sõber" },
  { id: "hooldaja", label: "Endale kui hooldajale", hint: "Soovite nõu, kuidas lähedast aidata" },
  { id: "asutus", label: "Lasteaiale, koolile või hooldekodule", hint: "Koolitus, nõu või vahendid teie asutusele" },
];

export interface Task {
  id: string;
  audience: AudienceId;
  /** Exact choice text. */
  label: string;
  /** Exact result sentence under „Sobivad tegevusterapeudid“. */
  result: string;
  /** Exact list under „Näiteid vahenditest“. */
  tools: readonly string[];
  tags: readonly Tag[];
  /**
   * False when the actual room or a physical transfer is central: video is
   * not offered as a safe delivery format for this task.
   */
  videoOk: boolean;
}

export const TASKS: readonly Task[] = [
  // Lapsele
  {
    id: "laps-pliiats",
    audience: "laps",
    label: "Lapsel on raske pliiatsit hoida või kääridega lõigata.",
    result: "Tegevusteraapias proovib laps eri viise pliiatsi hoidmiseks ja kääridega lõikamiseks.",
    tools: ["Jäme pliiats", "Käärid, mis avanevad ise", "Pliiatsihoidik"],
    tags: ["kirjutamine"],
    videoOk: true,
  },
  {
    id: "laps-riietumine",
    audience: "laps",
    label: "Lapsel on raske jopet kinni panna või paelu siduda.",
    result: "Tegevusteraapias harjutab laps luku kinnipanemist ja paelte sidumist väikeste sammude kaupa.",
    tools: ["Suur luku tõmbeaas", "Elastsed kingapaelad", "Paelte sidumise harjutuskaart"],
    tags: ["riietumine"],
    videoOk: true,
  },
  {
    id: "laps-soomine",
    audience: "laps",
    label: "Lapsel on raske lusikaga ise süüa.",
    result: "Tegevusteraapias proovitakse lapsega eri lusikaid ja viise, kuidas lusikat hoida.",
    tools: ["Jämeda varrega lusikas", "Libisemiskindel lauamatt", "Kõrgema servaga taldrik"],
    tags: ["soomine"],
    videoOk: true,
  },
  {
    id: "laps-myra",
    audience: "laps",
    label: "Lapsel on müras raske mängida või õppida.",
    result: "Tegevusteraapias proovitakse, kuidas sättida kohta ja tegevust nii, et laps saaks mängus või õppimises kaasa lüüa.",
    tools: ["Pildikaart pausi küsimiseks", "Lauasirm", "Mürasummutavad kõrvaklapid"],
    tags: ["sensoorne"],
    videoOk: true,
  },
  {
    id: "laps-uleminek",
    audience: "laps",
    label: "Lapsel on raske mängu lõpetada ja järgmise asja juurde minna.",
    result: "Tegevusteraapias harjutab laps ühe tegevuse lõpetamist ja järgmise alustamist piltide või kindla järjekorra abil.",
    tools: ["Piltidega päevakava", "Liivakell", "Kahe pildiga kaart „Kõigepealt ja siis”"],
    tags: ["uleminekud", "paevakava"],
    videoOk: true,
  },
  // Endale
  {
    id: "ise-kook",
    audience: "ise",
    label: "Pärast haigust või õnnetust on mul raske süüa teha.",
    result: "Tegevusteraapias harjutate köögitoiminguid endale sobival viisil ja proovite vajadusel teistsuguseid köögivahendeid.",
    tools: ["Purgiavaja", "Libisemiskindel alus", "Jämeda käepidemega köögivahend"],
    tags: ["kook"],
    videoOk: true,
  },
  {
    id: "ise-pesemine",
    audience: "ise",
    label: "Mul on raske pesta või riidesse panna.",
    result: "Tegevusteraapias proovite pesemiseks või riietumiseks eri võtteid ja vahendeid.",
    tools: ["Pika varrega pesukäsn", "Vahend soki jalgapanekuks", "Pika varrega kingalusikas"],
    tags: ["pesemine", "riietumine"],
    videoOk: true,
  },
  {
    id: "ise-haare",
    audience: "ise",
    label: "Mul on raske purke avada või asju kindlalt käes hoida.",
    result: "Tegevusteraapias proovite eri viise asjadest kinni haarata ning vahendeid, millega saab keerata või avada.",
    tools: ["Purgiavaja", "Libisemiskindel matt", "Jämeda varrega lusikas"],
    tags: ["haare"],
    videoOk: true,
  },
  {
    id: "ise-too",
    audience: "ise",
    label: "Mul on raske tööasju teha või tööle tagasi minna.",
    result: "Tegevusterapeut vaatab teiega tööülesanded läbi ning proovib koos teiega muudatusi töökohas või tööpäevas.",
    tools: ["Tööpäeva plaan ühel lehel", "Jalgealune", "Pauside meeldetuletus"],
    tags: ["too"],
    videoOk: true,
  },
  {
    id: "ise-paev",
    audience: "ise",
    label: "Mul on raske päeva planeerida ja asju tehtud saada.",
    result: "Tegevusteraapias valite ühe igapäevase ülesande ja harjutate selle tegemist väikeste sammude kaupa.",
    tools: ["Päevaplaan ühel lehel", "Tahvel meeldetuletusteks", "Lihtne taimer"],
    tags: ["paevakava"],
    videoOk: true,
  },
  // Eakale lähedasele
  {
    id: "eakas-vannituba",
    audience: "eakas",
    label: "Mu lähedane kardab vannitoas kukkuda.",
    result: "Tegevusterapeut vaatab koos teie lähedasega üle, kuidas ta vannituba kasutab ja mida võiks seal muuta.",
    tools: ["Vannitoa ülevaatuse leht", "Dušitool", "Seinale kinnitatav käepide"],
    tags: ["kukkumine", "kodu"],
    videoOk: false,
  },
  {
    id: "eakas-pusti",
    audience: "eakas",
    label: "Mu lähedasel on raske toolilt või voodist püsti saada.",
    result: "Tegevusteraapias proovib teie lähedane eri viise istuma ja püsti saamiseks oma tooli või voodi juures.",
    tools: ["Kindlate käetugedega tool", "Istekõrguse mõõtmise leht", "Öölamp"],
    tags: ["siirdumine"],
    videoOk: false,
  },
  {
    id: "eakas-kook",
    audience: "eakas",
    label: "Mu lähedasel on raske ise süüa teha või laua taga süüa.",
    result: "Tegevusteraapias proovitakse koos teie lähedasega, kuidas köögis asju paigutada ning milliseid söögi- või köögivahendeid kasutada.",
    tools: ["Kaanega tass", "Libisemiskindel lauamatt", "Purgiavaja"],
    tags: ["kook", "soomine"],
    videoOk: true,
  },
  {
    id: "eakas-meelest",
    audience: "eakas",
    label: "Mu lähedasel läheb meelest, mida ta pidi tegema.",
    result: "Tegevusteraapias proovib teie lähedane igapäevatoimingute meelespidamiseks nähtavaid meeldetuletusi ja kindlat järjekorda.",
    tools: ["Suure kirjaga kalender", "Tahvel meeldetuletusteks", "Piltidega juhis"],
    tags: ["meelespea", "paevakava"],
    videoOk: true,
  },
  {
    id: "eakas-haiglast",
    audience: "eakas",
    label: "Mu lähedane tuleb haiglast koju ja vajab kodus abi.",
    result: "Tegevusterapeut vaatab teie lähedasega üle, millised kodused toimetused vajavad harjutamist või muudatusi kodus.",
    tools: ["Kodu ülevaatuse leht", "Pika varrega kingalusikas", "Öölamp"],
    tags: ["kodu", "siirdumine"],
    videoOk: false,
  },
  // Endale kui hooldajale
  {
    id: "hooldaja-siirdumine",
    audience: "hooldaja",
    label: "Mul on raske aidata lähedast voodist toolile.",
    result: "Tegevusterapeut näitab teile ja teie lähedasele, kuidas proovida voodist toolile liikumist teie kodus.",
    tools: ["Voodi ja tooli kõrguse mõõtmise leht", "Küsimuste leht kodukülastuseks"],
    tags: ["siirdumine"],
    videoOk: false,
  },
  {
    id: "hooldaja-pesemine",
    audience: "hooldaja",
    label: "Ma ei tea, kuidas aidata lähedast pesemisel või riietumisel.",
    result: "Tegevusteraapias vaatate koos üle, mida lähedane saab ise teha ja milliste toimingute juures on tal abi vaja.",
    tools: ["Piltidega juhis", "Nimekiri riiete valmispanekuks", "Pika varrega pesukäsn"],
    tags: ["pesemine", "riietumine"],
    videoOk: true,
  },
  {
    id: "hooldaja-kodu",
    audience: "hooldaja",
    label: "Ma ei tea, mida kodus ümber tõsta või juurde panna.",
    result: "Tegevusterapeut vaatab teiega üle, kuidas lähedane kodus liigub ja kus peaksid vajalikud asjad olema.",
    tools: ["Kodu ülevaatuse leht", "Öölamp", "Libisemiskindel alus"],
    tags: ["kodu", "kukkumine"],
    videoOk: false,
  },
  {
    id: "hooldaja-vahend",
    audience: "hooldaja",
    label: "Ma ei tea, millist vahendit lähedane vajab.",
    result: "Tegevusterapeut vaatab koos teiega, milline toiming on raske ja millist vahendit tasub selle juures proovida.",
    tools: ["Küsimuste leht vahendi proovimiseks", "Purgiavaja", "Jämeda varrega lusikas"],
    tags: ["abivahendid"],
    videoOk: true,
  },
  {
    id: "hooldaja-paev",
    audience: "hooldaja",
    label: "Ma ei oska lähedase päeva nii seada, et ta saaks ise rohkem kaasa teha.",
    result: "Tegevusteraapias jagate ühe päevatoimingu sammudeks ja vaatate, millised neist saab lähedane ise teha.",
    tools: ["Piltidega päevakava", "Suure kirjaga kell", "Tegevuste nimekiri"],
    tags: ["paevakava"],
    videoOk: true,
  },
  // Lasteaiale, koolile või hooldekodule
  {
    id: "asutus-kirjutamine",
    audience: "asutus",
    label: "Soovime aidata lastel paremini pliiatsi ja kääridega toime tulla.",
    result: "Tegevusterapeut näitab teie töötajatele, kuidas kirjutamist ja lõikamist lastega harjutada.",
    tools: ["Jäme pliiats", "Käärid, mis avanevad ise", "Lõikamise harjutusleht"],
    tags: ["kirjutamine", "tootajad"],
    videoOk: true,
  },
  {
    id: "asutus-larm",
    audience: "asutus",
    label: "Mõnel lapsel on lärmis raske rühmas kaasa teha.",
    result: "Tegevusterapeut vaatab teiega üle rühmaruumi ja proovib, kuidas muuta tegevuses osalemist lihtsamaks.",
    tools: ["Piltidega päevakava", "Lauasirm", "Pildikaart pausi küsimiseks"],
    tags: ["sensoorne", "ruumid"],
    videoOk: true,
  },
  {
    id: "asutus-elanikud",
    audience: "asutus",
    label: "Soovime, et elanikud saaksid ise rohkem süüa või riidesse panna.",
    result: "Tegevusterapeut vaatab töötajatega üle söömise ja riietumise ning näitab, millistes sammudes saab elanik ise kaasa teha.",
    tools: ["Libisemiskindel lauamatt", "Jämeda varrega lusikas", "Pika varrega kingalusikas"],
    tags: ["soomine", "riietumine", "tootajad"],
    videoOk: true,
  },
  {
    id: "asutus-ruumid",
    audience: "asutus",
    label: "Mõnes ruumis on raske liikuda või vajalikke asju kätte saada.",
    result: "Tegevusterapeut käib teiega ruumid läbi ja soovitab, kuhu panna mööbel ja sageli kasutatavad asjad.",
    tools: ["Ruumi ülevaatuse leht", "Suure kirjaga uksesildid", "Sahtlisildid"],
    tags: ["ruumid", "kukkumine"],
    videoOk: false,
  },
  {
    id: "asutus-koolitus",
    audience: "asutus",
    label: "Soovime töötajatele koolitust selle kohta, kuidas inimest igapäevastes asjades aidata.",
    result: "Tegevusterapeut harjutab teie töötajatega, kuidas aidata inimest pesemisel, riietumisel või söömisel.",
    tools: ["Tegevuste harjutuskaardid", "Päevaplaan ühel lehel", "Suure kirjaga juhised"],
    tags: ["tootajad", "pesemine", "riietumine", "soomine"],
    videoOk: true,
  },
];

/** Shared fallback for all five branches. */
export const UNSURE = {
  id: "ei-tea",
  label: "Ei oska öelda, vajan nõu",
  result: "Tegevusterapeut aitab teil valida ühe igapäevase asja, millest alustada.",
  tools: ["Päevaplaan ühel lehel", "Leht, kuhu märkida, mis on raske"],
} as const;

/** One-line factual descriptions for tool examples where they help. */
export const TOOL_NOTES: Readonly<Record<string, string>> = {
  Purgiavaja: "Lai käepide, millest saab kinni võtta.",
  "Jäme pliiats": "Kolmnurkne ja paks, sõrmed ei libise.",
  "Käärid, mis avanevad ise": "Vedru avab terad pärast iga lõiget.",
  "Jämeda varrega lusikas": "Pehme ja paks vars, mida on lihtsam hoida.",
  "Libisemiskindel lauamatt": "Taldrik ja kauss püsivad paigal.",
  "Pika varrega kingalusikas": "Kingad saab jalga ilma kummardamata.",
  "Vahend soki jalgapanekuks": "Sokk tõmmatakse jalga kahe nööri abil.",
  "Piltidega päevakava": "Iga tegevus on üks pilt kindlas järjekorras.",
  Liivakell: "Näitab aega ilma numbriteta.",
  "Päevaplaan ühel lehel": "Prinditav leht, kuhu kirjutada päeva sammud.",
  Öölamp: "Valgustab teed voodist vannituppa.",
  "Suure kirjaga kalender": "Üks päev ühel lehel, suured numbrid.",
};

/**
 * Load-bearing or mounted equipment: fit, installation and intended use must
 * be reviewed by a therapist before any purchase.
 */
export const NEEDS_FITTING: ReadonlySet<string> = new Set(["Dušitool", "Seinale kinnitatav käepide", "Kindlate käetugedega tool"]);

export const TOOL_TRY_NOTE = "Vahendit tasub enne ostmist proovida. Küsige terapeudilt, mis teile sobib.";

export const SKA_AIDS_URL = "https://sotsiaalkindlustusamet.ee/puue-ja-hoolekanne/abivahendid/abivahendi-vajajale";

export function tasksFor(audience: AudienceId): Task[] {
  return TASKS.filter((t) => t.audience === audience);
}
