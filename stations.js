// Stationen des Zeitstrahls. years = vor wie vielen Jahren.
// Bilder: Wikimedia Commons (Datei-Name), Nachweis siehe credit/license.
const UNIVERSE_AGE = 13.787e9;

const STATIONS = [
  { id: 1, title: "Urknall", years: 13.787e9, when: "vor 13,8 Milliarden Jahren",
    text: "Alles beginnt: Raum, Zeit und Energie entstehen. Das Bild zeigt das älteste Licht des Universums.",
    img: "Cosmic_Microwave_Background_(CMB).jpeg", credit: "ESA und Planck-Kollaboration", license: "CC BY-SA 3.0 IGO" },
  { id: 2, title: "Die ersten Sterne", years: 13.6e9, when: "vor ca. 13,6 Milliarden Jahren",
    text: "Riesige Sterne aus Wasserstoff und Helium leuchten auf. In ihnen entstehen die Stoffe, aus denen später auch du bestehst.",
    img: "NASA-WMAP-first-stars.jpg", credit: "NASA / WMAP Science Team", license: "gemeinfrei" },
  { id: "L1", gap: true, title: "Leere", years: 10.6e9, when: "vor ca. 10,6 Milliarden Jahren",
    text: "Für unsere Erde passiert hier: nichts. Die Sonne gibt es noch lange nicht." },
  { id: "L2", gap: true, title: "Immer noch Leere", years: 7.6e9, when: "vor ca. 7,6 Milliarden Jahren",
    text: "Immer noch keine Sonne, keine Erde, kein Leben. Weiterlaufen!" },
  { id: 3, title: "Die Sonne entsteht", years: 4.567e9, when: "vor 4,57 Milliarden Jahren",
    text: "Aus einer Wolke aus Gas und Staub entsteht unsere Sonne. Um sie kreist eine Scheibe, aus der die Planeten wachsen.",
    img: "Artist’s_impression_of_a_young_star_surrounded_by_a_protoplanetary_disc.jpg", credit: "ESO / L. Calçada", license: "CC BY 4.0" },
  { id: 4, title: "Die Erde entsteht", years: 4.54e9, when: "vor 4,54 Milliarden Jahren",
    text: "Die Erde formt sich: eine glühende Kugel aus Gestein, ständig von Brocken aus dem All getroffen.",
    img: "Hadean.png", credit: "Tim Bertelink", license: "CC BY-SA 4.0" },
  { id: 5, title: "Der Mond entsteht", years: 4.51e9, when: "vor ca. 4,51 Milliarden Jahren",
    text: "Ein Himmelskörper, etwa so gross wie der Mars, kracht in die junge Erde. Aus den Trümmern bildet sich der Mond.",
    img: "Artist's_concept_of_collision_at_HD_172555.jpg", credit: "NASA / JPL-Caltech", license: "gemeinfrei" },
  { id: 6, title: "Die ersten Meere", years: 4.3e9, when: "vor ca. 4,3 Milliarden Jahren",
    text: "Die Erde kühlt ab. Wasserdampf regnet ab und füllt die ersten Ozeane.",
    img: "Early_Earth.jpg", credit: "Wikimedia Commons (Early Earth.jpg)", license: "siehe Commons" },
  { id: 7, title: "Das erste Leben", years: 3.48e9, when: "vor ca. 3,5 Milliarden Jahren",
    text: "Winzige Bakterien bilden Matten im Wasser. Ihre Spuren sind die ältesten sicheren Lebenszeichen. Ähnliche Bakterienhügel wachsen heute noch in Australien.",
    img: "Stromatolites_in_Sharkbay.jpg", credit: "Paul Harrison", license: "siehe Commons" },
  { id: 8, title: "Sauerstoff in der Luft", years: 2.4e9, when: "vor ca. 2,4 Milliarden Jahren",
    text: "Bakterien produzieren so viel Sauerstoff, dass er sich in der Luft sammelt. Eisen im Meer rostet und bildet gestreiftes Gestein.",
    img: "Jaspilite_banded_iron_formation_(BIF)_(Hamersely_Group,_Neoarchean_to_Paleoproterozoic,_~2.47-2.55_Ga;_Hamersley_Range,_Western_Australia)_(15036345446).jpg", credit: "James St. John", license: "CC BY 2.0" },
  { id: 9, title: "Die ersten Mehrzeller", years: 1.6e9, when: "vor ca. 1,6 Milliarden Jahren",
    text: "Zellen beginnen zusammenzuarbeiten. Die ersten Lebewesen aus vielen Zellen entstehen, zum Beispiel einfache Algen.",
    img: "Grypania_spiralis,_Empire_Mine_near_Ishpeming_MI.jpg", credit: "James St. John", license: "CC BY 2.0" },
  { id: 10, title: "Explosion der Tiervielfalt", years: 538.8e6, when: "vor 539 Millionen Jahren",
    text: "In kurzer Zeit entstehen viele Tiergruppen mit Augen, Panzern und Beinen. Anomalocaris war einer der ersten grossen Räuber.",
    img: "20191203_Anomalocaris_canadensis.png", credit: "Junnn11", license: "CC BY-SA 4.0" },
  { id: 11, title: "Pflanzen erobern das Land", years: 470e6, when: "vor ca. 470 Millionen Jahren",
    text: "Die ersten Pflanzen wagen sich an Land. Sie sind winzig und haben weder Wurzeln noch Blätter.",
    img: "Cooksonia_pertoni.png", credit: "Smith609", license: "siehe Commons" },
  { id: 12, title: "Die ersten Dinosaurier", years: 230e6, when: "vor ca. 230 Millionen Jahren",
    text: "Die ersten Dinosaurier tauchen auf, zum Beispiel Herrerasaurus in Südamerika.",
    img: "Herrerasaurus_ischigualastensis_Illustration.jpg", credit: "Fred Wierum", license: "CC BY-SA 4.0" },
  { id: 13, title: "Der Asteroid", years: 66e6, when: "vor 66 Millionen Jahren",
    text: "Ein rund 10 km grosser Asteroid schlägt in Mexiko ein. Die meisten Dinosaurier sterben aus. Ihre Nachfahren leben weiter: die Vögel.",
    img: "Chicxulub_impact_-_artist_impression.jpg", credit: "Donald E. Davis / NASA", license: "gemeinfrei" },
  { id: 14, title: "Die ersten Menschen", years: 300e3, when: "vor ca. 300 000 Jahren",
    text: "Die ältesten bekannten Funde unserer Art, Homo sapiens, stammen aus Marokko.",
    img: "Homo_sapiens_sapiens_(Fundort_Jebel_Irhoud_Marokko).jpg", credit: "Rekonstruktion A. & A. Kennis, Neanderthal Museum", license: "siehe Commons" },
  { id: 15, title: "Heute", years: 0, when: "jetzt",
    text: "Hier stehst du. Alles, was Menschen je gebaut, geschrieben und erfunden haben, passt in den letzten Millimeter.",
    img: "The_Blue_Marble_(remastered).jpg", credit: "NASA / Apollo 17", license: "gemeinfrei" },
];

function imgUrl(file, width = 1280) {
  return "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(file) + "?width=" + width;
}
function commonsPage(file) {
  return "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(file);
}
// Position in Metern ab Start
function positionM(st, trackLen) {
  return trackLen * (1 - st.years / UNIVERSE_AGE);
}
function fmtDist(m) {
  if (m >= 1) return m.toLocaleString("de-CH", { maximumFractionDigits: 2 }) + " m";
  if (m >= 0.01) return (m * 100).toLocaleString("de-CH", { maximumFractionDigits: 1 }) + " cm";
  return (m * 1000).toLocaleString("de-CH", { maximumFractionDigits: 2 }) + " mm";
}
