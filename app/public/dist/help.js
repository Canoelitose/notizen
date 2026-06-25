const {
  useState: useStateH
} = React;
function HelpView() {
  const sections = [{
    id: "start",
    title: "Erste Schritte",
    icon: "compass",
    items: [{
      h: "Notizen erstellen",
      b: "Oben in der Notizliste auf „+ Neu“ klicken. Wähle ein Template oder erstelle eine leere Notiz. Notizen werden im aktuell ausgewählten Ordner abgelegt."
    }, {
      h: "Ordner verwalten",
      b: "Rechte Sidebar zeigt die Ordnerstruktur. Klicke auf „+“ neben „Ordner“, um einen neuen Ordner anzulegen. Doppelklick auf einen Ordnernamen klappt ihn auf/zu. Drag&Drop verschiebt Notizen und Ordner. Rechtsklick auf einen Ordner öffnet das Kontextmenü."
    }, {
      h: "Bearbeiten vs. Ansehen",
      b: "Oben rechts in jeder Notiz schaltest du zwischen „Bearbeiten“ und „Fertig“ um. Im Bearbeiten-Modus siehst du Drag-Handles, Block-Lösch-Buttons und kannst alles ändern. Im Fertig-Modus werden Wiki-Links klickbar und das Layout ist sauberer."
    }, {
      h: "Tastenkürzel",
      b: "• Strg/Cmd+N — Neue Notiz\n• Strg/Cmd+K oder F — Suche fokussieren\n• Strg/Cmd+Shift+T — Heutige Tagesnotiz öffnen\n• Strg/Cmd+Shift+D — Theme wechseln (Hell/Dunkel/Auto)\n• Strg/Cmd+Shift+I — Neue IT-Notiz\n• Escape — Modale schließen / Kontextmenü schließen"
    }]
  }, {
    id: "views",
    title: "Sammlungen & Ansichten",
    icon: "inbox",
    items: [{
      h: "Übersicht",
      b: "Dashboard mit allen wichtigen Stats, Aktivitäts-Heatmap, zuletzt bearbeiteten Notizen, Favoriten, anstehenden Terminen und Ordnern auf einen Blick. Klick auf jeden Eintrag öffnet die Notiz oder den Ordner direkt."
    }, {
      h: "Alle Notizen",
      b: "Komplette Liste aller Notizen, sortiert nach Aktualisierungsdatum (gepinnte oben). Mit der Suche und den Filter-Chips (Alle / IT / Normal) lässt sich einschränken."
    }, {
      h: "Favoriten",
      b: "Sternsymbol setzt eine Notiz auf „Favorit“. Diese Sammlung zeigt nur favorisierte Notizen."
    }, {
      h: "HERMES-Projekt…",
      b: "Erzeugt mit einem Klick einen kompletten Projektordner nach HERMES-2022-Methodik: 4 Phasenordner (Initialisierung / Konzept / Realisierung / Einführung) + Steuerung. Du wählst aus 22 Vorlagen, was du brauchst (Projektauftrag, PMP, Risikoliste, ISDS-Konzept, Testkonzept, Abnahmeprotokoll, Statusbericht etc.). Projektname wird als `{{projekt}}` in den Vorlagen eingesetzt."
    }, {
      h: "Heute (Tagesnotiz)",
      b: "Öffnet (oder erstellt) die heutige Notiz im Ordner „Tagesnotizen“. Voreingestellt mit Datum, Wochentag, KW und einer leeren Checkliste „Heute geplant“. Ideal für Standups, Tagesplanung, Journal. Auch via Strg/Cmd+Shift+T."
    }, {
      h: "Graph",
      b: "Force-Directed-Visualisierung aller Notizen als Netzwerk. Knoten = Notizen (Farbe nach Ordner), Kanten = Wiki-Links + Notiz-Link-Blöcke. Knoten anklicken markiert, „Öffnen“-Button in der Toolbar springt zur Notiz. Drag verschiebt Knoten, Mausrad zoomt zum Cursor, Hintergrund-Drag schwenkt."
    }, {
      h: "Kanban",
      b: "Notizen als Karten in den Statusspalten „Offen“, „In Arbeit“, „Blockiert“, „Erledigt“. Karten per Drag&Drop zwischen Spalten ziehen ändert den Status der Notiz. Filter oben rechts schränkt auf einen Ordner ein. Klick öffnet die Notiz."
    }, {
      h: "Timeline",
      b: "Horizontale Zeitachse aller Notizen mit Fälligkeitsdatum, gruppiert nach Stammordner. „Heute“-Linie markiert das aktuelle Datum. Überfällige Termine sind rot, in den nächsten 3 Tagen fällige gelb. Klick auf eine Pille öffnet die Notiz."
    }, {
      h: "Smart-Sammlungen",
      b: "Dynamische, automatisch gefüllte Sammlungen. Sichtbar in der Sidebar, sobald sie mindestens eine Notiz enthalten: Überfällig, Diese Woche, Warnungen (Status warning/error), Ohne Tag."
    }, {
      h: "Papierkorb",
      b: "Gelöschte Notizen und Ordner werden 30 Tage aufbewahrt. „Wiederherstellen“ macht den Löschvorgang rückgängig — auch beim Cascade-Delete eines kompletten HERMES-Projekts wird der ganze Batch wieder zurückgespielt. Endgültiges Löschen oder „Leeren“ entfernt unwiderruflich."
    }]
  }, {
    id: "blocks",
    title: "Block-Editor",
    icon: "type",
    items: [{
      h: "Was sind Blöcke",
      b: "Eine Normale Notiz besteht aus Blöcken, die du flexibel kombinieren kannst. Im Bearbeiten-Modus erscheint unten eine Leiste „Block hinzufügen“ mit allen Typen. Blöcke lassen sich per Drag-Handle (links neben dem Block) neu sortieren."
    }, {
      h: "Text / Überschrift / Zwischenüberschrift",
      b: "Reine Textblöcke. Auto-Resize mit der Eingabe. Im Fertig-Modus werden Wiki-Links (siehe weiter unten) gerendert."
    }, {
      h: "Checkliste",
      b: "Klassische To-do-Liste. Backspace auf einem leeren Eintrag löscht ihn. Neben jedem Eintrag: „+“ für neuen Eintrag, Pfeil-Icon für Wiederholungs-Intervall (keine / täglich / wöchentlich / monatlich)."
    }, {
      h: "Code-Block",
      b: "Syntax-Highlighting via Prism für viele Sprachen (Bash, Python, JavaScript, SQL, YAML, Docker u. v. m.). Optionaler Output-Bereich mit eigenem Toggle. Copy-Button rechts oben."
    }, {
      h: "Tabelle",
      b: "Spalten + Zeilen mit beliebigem Inhalt. Reihen/Spalten unten hinzufügen/entfernen. Zellen können auch Formeln enthalten — siehe Spreadsheet-Formeln weiter unten."
    }, {
      h: "Bild",
      b: "Klicken oder ein Bild in den leeren Bereich ziehen. Optionale Bildunterschrift darunter."
    }, {
      h: "Datei",
      b: "Beliebige Datei anhängen (PDF, Office, Bilder, Video, Audio). Vorschau für PDF, Office (Word/Excel/PowerPoint), Bilder, Video, Audio. Alternativ via URL einbetten."
    }, {
      h: "Status",
      b: "Vier-stufiger Status: Erfolgreich / Warnung / Fehler / Hinweis. Diesen Status nutzt auch die Kanban-Spalte."
    }, {
      h: "Links",
      b: "Liste verwandter externer URLs mit Beschriftung. Erscheinen als klickbare Link-Chips."
    }, {
      h: "Notiz-Link",
      b: "Verweis auf eine andere Notiz im System. Picker zeigt die Ordnerstruktur, Suche filtert live. Optionaler eigener Linktext, sonst der Notiztitel. Im Fertig-Modus klickbar — springt direkt zur Ziel-Notiz."
    }, {
      h: "Rezept-Info & Zutaten",
      b: "Spezial-Blöcke für Kochrezepte: Portionen, Vorbereitung/Kochzeit/Schwierigkeit oben, dann eine strukturierte Zutatenliste mit Menge + Einheit + Bezeichnung."
    }]
  }, {
    id: "links",
    title: "Verlinkungen",
    icon: "link",
    items: [{
      h: "Wiki-Links [[Notizname]]",
      b: "Schreibe `[[Risikoliste]]` in einem Text-/Heading-/Subheading-Block. Im Fertig-Modus wird daraus ein klickbarer Akzent-Link. Existiert die Notiz nicht, erscheint ein gestrichelter Platzhalter. Das Matching ist tolerant: `[[Risikoliste]]` findet auch `05 — Risikoliste` (HERMES-Nummerierungs-Präfix wird ignoriert)."
    }, {
      h: "Notiz-Link-Block (empfohlen)",
      b: "Eigenständige verlinkbare Karte als Block — viel sichtbarer als Inline-`[[...]]`. Im Editor: Notiz aus der Ordnerstruktur auswählen, optional eigenen Linktext setzen. Im Fertig-Modus eine prominente klickbare Karte mit Icon, Titel und Ordnerpfad."
    }, {
      h: "Graph-Ansicht",
      b: "Alle Wiki-Links und Notiz-Link-Blöcke werden im Graph als Kanten zwischen Notizen-Knoten dargestellt. Knoten in derselben Ordner-Hierarchie haben dieselbe Farbe — so siehst du auf einen Blick verbundene Cluster."
    }]
  }, {
    id: "due",
    title: "Fälligkeiten",
    icon: "flag",
    items: [{
      h: "Datum setzen",
      b: "In jeder Notiz unten in der Meta-Zeile auf „+ Fälligkeit“ klicken. Datum und Uhrzeit eintippen oder Kalender öffnen. Mit „Entfernen“ löschst du das Datum wieder."
    }, {
      h: "Farbkodierung",
      b: "Notizen-Karten und Dashboard zeigen Status nach Fälligkeit:\n• Neutral: weiter in der Zukunft\n• Gelb (Bald): innerhalb der nächsten 3 Tage\n• Rot (Überfällig): Datum überschritten"
    }, {
      h: "Smart-Sammlung „Überfällig“",
      b: "Erscheint automatisch in der Sidebar, sobald mindestens eine Notiz überfällig ist. „Diese Woche“ listet alle Termine in den nächsten 7 Tagen."
    }, {
      h: "Dashboard-Karte „Fällig“",
      b: "Zeigt die nächsten 6 Fälligkeiten chronologisch + Anzahl der überfälligen Notizen als Badge."
    }, {
      h: "Timeline",
      b: "Alle Fälligkeiten auf einer horizontalen Zeitachse, gruppiert nach Stammordner. Ideal für Projekt-Überblick."
    }]
  }, {
    id: "tasks",
    title: "Wiederkehrende Aufgaben",
    icon: "undo",
    items: [{
      h: "Wiederholung aktivieren",
      b: "In einer Checkliste auf das ↻-Icon neben einem Eintrag klicken. Klick durch: keine → täglich → wöchentlich → monatlich → keine. Der Eintrag bekommt einen Akzent-Rand und ein farbiges Label (z. B. „wöch“)."
    }, {
      h: "Verhalten beim Abhaken",
      b: "Wenn du einen wiederkehrenden Eintrag abhakst, wird kurz das Häkchen gezeigt und nach ~1,4 s automatisch zurückgesetzt. So bleibt die Aufgabe für die nächste Wiederholung sichtbar."
    }, {
      h: "Anwendungsfälle",
      b: "Statusbericht wöchentlich, Backup-Check täglich, Monats-Review monatlich. Auch in der Tagesnotiz-Vorlage praktisch für Routine-Tasks."
    }]
  }, {
    id: "templates",
    title: "Templates & Variablen",
    icon: "bookmark",
    items: [{
      h: "Eigene Templates speichern",
      b: "Im ⋯-Menü einer Notiz „Als Template speichern“ wählen. Die Block-Struktur wird gespeichert (Texte werden geleert, Checklisten zurückgesetzt). Verfügbar im „+ Neu“-Dropdown als „Templates“."
    }, {
      h: "Variablen",
      b: "In Templates kannst du Platzhalter verwenden, die beim Instanziieren automatisch ersetzt werden:\n• `{{datum}}` → 26.05.2026\n• `{{zeit}}` → 14:30\n• `{{wochentag}}` → Montag\n• `{{monat}}` → Mai\n• `{{jahr}}` → 2026\n• `{{KW}}` oder `{{kw}}` → KW 22\n• `{{projekt}}` → Name des Ordners, in dem die Notiz angelegt wird\n• `{{ich}}` → eigener Name (aus localStorage)"
    }, {
      h: "HERMES-Templates",
      b: "Beim Anlegen eines HERMES-Projekts werden alle gewählten Vorlagen mit Projektnamen vorbefüllt. Du kannst aus 22 Standard-Dokumenten auswählen oder die schlanke „Empfohlen“-Auswahl mit den 8 Kerndokumenten nehmen."
    }]
  }, {
    id: "export",
    title: "Export & Drucken",
    icon: "download",
    items: [{
      h: "Drucken / PDF",
      b: "Im ⋯-Menü einer Notiz „Drucken / PDF“. Browser-Druckdialog mit sauberem A4-Layout. Im Druck-Dialog „Als PDF speichern“ wählen, um eine PDF zu erzeugen. Sidebar, Toolbar und Edit-Controls werden ausgeblendet."
    }, {
      h: "Markdown-Export einzeln",
      b: "⋯ → „Als Markdown exportieren“ lädt die aktuelle Notiz als `.md`-Datei. Headings, Listen, Tabellen, Code-Blöcke werden korrekt formatiert."
    }, {
      h: "JSON-Bundle (komplett)",
      b: "Sidebar → „Export“. Wähle Ordner und einzelne Notizen aus. Im JSON-Format bleiben Struktur, Tags, Blöcke und Status erhalten — re-importierbar 1:1."
    }, {
      h: "Import",
      b: "Sidebar → „Import“. JSON-Bundle ablegen oder auswählen. Modus „Hinzufügen“ merged mit Bestehendem, „Alles ersetzen“ wirft alles raus und ersetzt komplett (⚠ unwiderruflich, nutze vorher Export als Backup)."
    }]
  }, {
    id: "spreadsheet",
    title: "Spreadsheet-Formeln",
    icon: "table",
    items: [{
      h: "Grundprinzip",
      b: "Jede Tabellenzelle, deren Inhalt mit `=` beginnt, wird als Formel ausgewertet. Im Fokus siehst du die rohe Formel, sonst das Ergebnis. Formel-Zellen werden farbig hervorgehoben (in Mono-Schrift)."
    }, {
      h: "Zellbezüge",
      b: "Spalten werden mit Buchstaben (A, B, C…) und Zeilen mit Nummern (1, 2, 3…) referenziert — z. B. `A1` = erste Spalte erste Zeile. Beispiel: `=A1+B1` summiert die ersten beiden Zellen einer Zeile."
    }, {
      h: "Bereiche",
      b: "`A1:A5` bezeichnet einen Bereich (hier A1 bis A5). `A1:C3` ist ein 2D-Bereich mit 9 Zellen. Bereiche werden hauptsächlich in Aggregations-Funktionen genutzt."
    }, {
      h: "Funktionen",
      b: "• `SUM(A1:A5)` — Summe\n• `AVG(A1:A5)` / `AVERAGE(A1:A5)` — Durchschnitt\n• `MIN(A1:A5)` — Minimum\n• `MAX(A1:A5)` — Maximum\n• `COUNT(A1:A5)` — Anzahl Werte\n• `PRODUCT(A1:A5)` — Produkt aller Werte"
    }, {
      h: "Operatoren",
      b: "`+`, `-`, `*`, `/`, Klammern. Beispiele:\n• `=A1*1.19` (mit 19% Mehrwertsteuer)\n• `=(A1+B1)/2` (Mittelwert von zwei Zellen)\n• `=SUM(A1:A10)*0.15` (15% der Spaltensumme)"
    }, {
      h: "Deutsche Kommata",
      b: "Du kannst Dezimalwerte mit Komma schreiben — `1,5` wird intern als `1.5` behandelt. Das gilt auch für Zellinhalte, die Formeln referenzieren."
    }, {
      h: "Verkettete Formeln",
      b: "Eine Formel-Zelle kann auf eine andere Formel-Zelle verweisen — diese wird vor der Auswertung selbst rekursiv evaluiert. So lassen sich komplexe Berechnungen aus mehreren Schritten aufbauen."
    }, {
      h: "Fehler",
      b: "Bei Syntax-Fehlern oder unerwarteten Werten zeigt die Zelle `#ERR`. Häufige Ursachen: Klammer nicht geschlossen, ungültige Zellreferenz, Division durch 0."
    }, {
      h: "Tipps & Beispiele",
      b: "Klassische HERMES-Aufwandskalkulation:\n\nSpalten: Position | PT | Stundensatz | Kosten\n• Zelle „Kosten“: `=B2*C2`\n• Summe ganz unten: `=SUM(D2:D10)`\n• Mit Reserve (15%): `=SUM(D2:D10)*1.15`"
    }]
  }, {
    id: "ui",
    title: "Layout & Bedienung",
    icon: "monitor",
    items: [{
      h: "Sidebar einklappen",
      b: "Kleiner Chevron-Button (‹) rechts neben dem Theme-Picker in der Brand-Zeile klappt die Sidebar ein. Hamburger-Icon links in der Notizliste blendet sie wieder ein."
    }, {
      h: "Notizliste einklappen",
      b: "Chevron rechts neben „+ Neu“ in der Listen-Header klappt die mittlere Spalte ein. Hamburger-Icon ganz links in der Editor-Toolbar bringt sie zurück."
    }, {
      h: "Rechtsklick-Menüs",
      b: "Praktisch überall: Rechtsklick auf Notiz, Ordner, Graph-Knoten öffnet ein Kontextmenü mit den relevanten Aktionen (Öffnen, Umbenennen, Duplizieren, Als Template speichern, Markdown-Export, Drucken, Löschen)."
    }, {
      h: "Drag & Drop",
      b: "• Notizen lassen sich zwischen Ordnern verschieben\n• Ordner können in andere Ordner gezogen werden (inkl. Sortierung „davor/danach“)\n• Blöcke innerhalb einer Notiz per Drag-Handle neu sortieren\n• Kanban-Karten zwischen Spalten ziehen ändert den Status"
    }, {
      h: "Theme",
      b: "Brand-Bereich oben in der Sidebar zeigt einen Theme-Knopf. Drei Modi: Hell / Dunkel / Automatisch (folgt System-Einstellung). Akzentfarbe und Schriftgröße in den Tweaks anpassbar."
    }, {
      h: "Suche",
      b: "Suchfeld oben in der Notizliste filtert nach Titel, Tags und allen Block-Inhalten. Strg/Cmd+K oder Strg/Cmd+F fokussiert das Feld direkt."
    }]
  }, {
    id: "tweaks",
    title: "Tweaks",
    icon: "settings",
    items: [{
      h: "Tweaks öffnen",
      b: "Über die Tweaks-Toolbar (sofern vom Host eingeblendet) lassen sich Aussehen und Daten anpassen."
    }, {
      h: "Anpassbar",
      b: "• Akzentfarbe (5 Kuratierte Farben)\n• Schriftgröße (relativ)\n• Dichte (Komfort / Kompakt)\n• Demo-Inhalte zurücksetzen — löscht alles und stellt die Beispiel-Notizen wieder her (⚠ irreversibel)."
    }]
  }, {
    id: "data",
    title: "Daten & Speicherung",
    icon: "database",
    items: [{
      h: "Wo werden meine Daten gespeichert?",
      b: "Komplett im `localStorage` deines Browsers — keine Cloud, kein Server, kein Account. Pro Browser/Gerät eigene Daten."
    }, {
      h: "Backup",
      b: "Regelmäßiger Export als JSON ist die einzige zuverlässige Backup-Methode. Datei sicher aufbewahren — sie enthält alle Notizen + Ordnerstruktur."
    }, {
      h: "Daten auf anderes Gerät übertragen",
      b: "Auf Gerät A: Sidebar → Export → JSON-Bundle.\nAuf Gerät B: Sidebar → Import → Datei auswählen → „Alles ersetzen“ oder „Hinzufügen“."
    }, {
      h: "Cache leeren",
      b: "⚠ Browser-Cache / Site-Daten zu löschen entfernt alle Notizen. Vorher exportieren!"
    }]
  }];
  return React.createElement("section", {
    className: "help-view"
  }, React.createElement("div", {
    className: "help-head"
  }, React.createElement("h1", null, "Anleitung"), React.createElement("div", {
    className: "help-sub"
  }, "Alle Funktionen erkl\xE4rt \u2014 von den Grundlagen bis zu den Spreadsheet-Formeln.")), React.createElement("nav", {
    className: "help-toc"
  }, sections.map(s => React.createElement("a", {
    key: s.id,
    href: `#help-${s.id}`,
    className: "help-toc-item"
  }, React.createElement(Icon, {
    name: s.icon,
    size: 13
  }), React.createElement("span", null, s.title)))), React.createElement("div", {
    className: "help-content"
  }, sections.map(s => React.createElement("section", {
    key: s.id,
    id: `help-${s.id}`,
    className: "help-section"
  }, React.createElement("h2", null, React.createElement(Icon, {
    name: s.icon,
    size: 16
  }), " ", s.title), React.createElement("div", {
    className: "help-items"
  }, s.items.map((it, i) => React.createElement("div", {
    key: i,
    className: "help-item"
  }, React.createElement("h3", null, it.h), React.createElement("div", {
    className: "help-item-body"
  }, it.b.split("\n").map((line, li) => React.createElement("p", {
    key: li
  }, line)))))))), React.createElement("div", {
    className: "help-foot"
  }, React.createElement(Icon, {
    name: "smile",
    size: 14
  }), React.createElement("span", null, "Viel Erfolg mit deinen Notizen!"))));
}
window.HelpView = HelpView;