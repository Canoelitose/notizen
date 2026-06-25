(function () {
  const uid = window.uid;
  const nowIso = window.nowIso;
  const H = text => ({
    kind: "heading",
    text
  });
  const S = text => ({
    kind: "subheading",
    text
  });
  const T = text => ({
    kind: "text",
    text
  });
  const CL = (...items) => ({
    kind: "checklist",
    items: items.map(t => ({
      text: t,
      done: false
    }))
  });
  const TBL = (headers, rows) => ({
    kind: "table",
    headers,
    rows
  });
  const ST = (value = "neutral") => ({
    kind: "status",
    value
  });
  const DOCS = [{
    phase: "init",
    icon: "doc",
    title: "01 — Studie (Lösungsvarianten)",
    tags: ["hermes", "initialisierung", "studie"],
    blocks: p => [T(`HERMES-Phase: Initialisierung · Projekt: **${p}**`), H("1. Ausgangslage"), T("Beschreibung der aktuellen Situation, des Auslösers und des Handlungsbedarfs."), H("2. Ziele & Rahmenbedingungen"), S("Projektziele"), CL("Geschäftsziel 1 …", "Geschäftsziel 2 …", "Nicht-Ziel: …"), S("Rahmenbedingungen"), CL("Termine / Meilensteine", "Budget-Rahmen", "Rechtliche Vorgaben", "Technische Vorgaben"), H("3. Lösungsvarianten"), TBL(["#", "Variante", "Beschreibung", "Aufwand (CHF)", "Nutzen", "Risiko"], [["V1", "Status quo / Verzicht", "Keine Veränderung", "0", "—", "Hoch"], ["V2", "Eigenentwicklung", "Inhouse umsetzen", "—", "Hoch", "Mittel"], ["V3", "Standardprodukt", "COTS einkaufen", "—", "Mittel", "Tief"], ["V4", "Hybrid", "Standardprodukt + Anpassungen", "—", "Hoch", "Mittel"]]), H("4. Empfehlung"), T("Empfohlene Variante mit kurzer Begründung. Wirtschaftlichkeit, Risiken, Strategiefit."), H("5. Grobplanung"), TBL(["Phase", "Start", "Ende", "Hauptergebnisse"], [["Konzept", "", "", "Anforderungen, Architektur"], ["Realisierung", "", "", "Lösung gebaut & getestet"], ["Einführung", "", "", "Produktivnahme, Abnahme"]]), H("6. Entscheid"), ST("neutral"), T("Auftraggeber-Entscheid: Variante __ wird weiterverfolgt. Datum: __. Unterschrift: __")]
  }, {
    phase: "init",
    icon: "briefcase",
    title: "02 — Projektauftrag",
    tags: ["hermes", "initialisierung", "auftrag"],
    blocks: p => [T(`Projekt: **${p}**  ·  Version 0.1  ·  Datum: __`), H("1. Projektidentifikation"), TBL(["Feld", "Wert"], [["Projektname", p], ["Projektnummer", "__"], ["Auftraggeber", "__"], ["Projektleiter", "__"], ["Auftragnehmer", "__"], ["Start / Ende", "__ / __"]]), H("2. Ausgangslage & Auslöser"), T("Was hat das Projekt ausgelöst? Welches Problem soll gelöst werden?"), H("3. Projektziele"), S("Leistungsziele (was wird geliefert)"), CL("…", "…"), S("Termin- und Kostenziele"), CL("Abnahme bis: __", "Budget: CHF __", "Personalaufwand: __ PT"), S("Qualitätsziele"), CL("…"), H("4. Lieferobjekte"), TBL(["Nr.", "Lieferobjekt", "Verantwortlich", "Termin"], [["1", "Konzept", "PL", "__"], ["2", "Lösung produktiv", "PL", "__"], ["3", "Abnahmeprotokoll", "AG", "__"]]), H("5. Abgrenzung"), T("Was ist NICHT Bestandteil dieses Projekts."), H("6. Annahmen & Voraussetzungen"), CL("Annahme 1 …", "Voraussetzung 1 …"), H("7. Organisation"), TBL(["Rolle", "Person", "Aufwand %"], [["Auftraggeber", "__", "5"], ["Projektleiter", "__", "60"], ["Fachvertreter", "__", "20"], ["IT-Architekt", "__", "30"]]), H("8. Freigabe"), ST("warning"), T("Auftraggeber: __ (Datum, Unterschrift)\nProjektleiter: __ (Datum, Unterschrift)")]
  }, {
    phase: "init",
    icon: "calendar",
    title: "03 — Projektmanagementplan (PMP)",
    tags: ["hermes", "initialisierung", "pmp"],
    blocks: p => [T(`Projektmanagementplan für **${p}**.  Lebendes Dokument — bei Änderungen aktualisieren.`), H("1. Phasen- & Meilensteinplanung"), TBL(["Meilenstein", "Phase", "Datum", "Ergebnis"], [["MS0 Initialisierung freigegeben", "Init", "__", "Projektauftrag"], ["MS1 Konzept freigegeben", "Konzept", "__", "Anforderungen, Architektur"], ["MS2 Realisierung abgeschlossen", "Realis.", "__", "Lösung getestet"], ["MS3 Einführung freigegeben", "Einf.", "__", "Abnahme erteilt"], ["MS4 Projektabschluss", "Abschl.", "__", "Schlussbericht"]]), H("2. Vorgehen & Methodik"), CL("Vorgehensmodell: HERMES 2022 / klassisch / agil / hybrid", "Iterationen / Sprints: __", "Reviews / Releases: __"), H("3. Aufwand & Kosten"), TBL(["Position", "PT", "CHF"], [["Projektleitung", "__", "__"], ["Analyse / Konzept", "__", "__"], ["Realisierung", "__", "__"], ["Test", "__", "__"], ["Einführung", "__", "__"], ["Reserve (15 %)", "__", "__"], ["**Total**", "__", "__"]]), H("4. Qualitätsmanagement"), CL("Reviews (Architektur, Code, Doku) eingeplant", "Definition of Done definiert", "Testkonzept liegt vor", "Abnahmekriterien dokumentiert"), H("5. Risikomanagement"), T("Siehe separate Risikoliste. Review-Rhythmus: monatlich."), H("6. Berichtswesen"), TBL(["Bericht", "Empfänger", "Rhythmus"], [["Statusbericht", "Auftraggeber", "monatlich"], ["Teilprojektstatus", "PL", "wöchentlich"], ["Lenkungsausschuss", "LA-Mitglieder", "alle 2 Monate"]]), H("7. Konfigurations- & Change-Management"), CL("Ablage Projektdokumentation: __", "Versionierungsregeln definiert", "Change-Request-Prozess etabliert")]
  }, {
    phase: "init",
    icon: "globe",
    title: "04 — Stakeholderliste",
    tags: ["hermes", "initialisierung", "stakeholder"],
    blocks: p => [T(`Stakeholder-Übersicht für **${p}**. Bei Bedarf um eine Einfluss/Interesse-Matrix erweitern.`), H("Stakeholder"), TBL(["Name / Gremium", "Rolle", "Interesse", "Einfluss", "Haltung", "Massnahme"], [["__", "Auftraggeber", "hoch", "hoch", "+", "Eng einbinden"], ["__", "Fachbereich", "hoch", "mittel", "+", "Informieren, Workshops"], ["__", "Endanwender", "hoch", "tief", "?", "Schulung, Pilot"], ["__", "Betrieb / IT-OPS", "mittel", "hoch", "?", "Frühzeitig einbeziehen"], ["__", "Datenschutz / ISDS", "mittel", "hoch", "?", "Reviews einplanen"], ["__", "Lieferant", "hoch", "mittel", "+", "Vertrag, Reviews"]]), S("Legende"), T("Haltung: + befürwortend / − ablehnend / ? unklar.  Einfluss & Interesse: tief / mittel / hoch.")]
  }, {
    phase: "init",
    icon: "shield",
    title: "05 — Risikoliste",
    tags: ["hermes", "initialisierung", "risiken"],
    blocks: p => [T(`Risikoregister für **${p}**. Wird in jeder Phase aktualisiert.`), ST("warning"), TBL(["#", "Risiko", "Ursache", "Eintritt", "Auswirkung", "Massnahme", "Owner", "Status"], [["R1", "Anforderungen unklar", "Fachseite nicht verfügbar", "M", "Hoch", "Workshops, Prototyp", "PL", "offen"], ["R2", "Ressourcenkonflikt", "Parallele Projekte", "H", "Mittel", "Frühe Reservierung", "PL", "offen"], ["R3", "Technische Komplexität", "Neue Technologie", "M", "Hoch", "PoC, Schulung", "Architekt", "offen"], ["R4", "Lieferant-Verzug", "Externe Abhängigkeit", "M", "Hoch", "Pönale, Reviews", "PL", "offen"], ["R5", "ISDS-Auflagen", "Späte Bewertung", "M", "Hoch", "ISDS-Konzept früh", "ISDS", "offen"]]), S("Bewertung"), T("Eintritt × Auswirkung — T (tief) / M (mittel) / H (hoch). Massnahmen: vermeiden / vermindern / übertragen / akzeptieren.")]
  }, {
    phase: "konzept",
    icon: "type",
    title: "06 — Anforderungsspezifikation",
    tags: ["hermes", "konzept", "anforderungen"],
    blocks: p => [T(`Anforderungen an die Lösung **${p}**.`), H("1. Funktionale Anforderungen"), TBL(["ID", "Anforderung", "Priorität", "Quelle", "Akzeptanzkriterium"], [["F-01", "…", "MUSS", "Fachbereich", "…"], ["F-02", "…", "SOLL", "PL", "…"], ["F-03", "…", "KANN", "Anwender", "…"]]), H("2. Nicht-funktionale Anforderungen"), TBL(["ID", "Kategorie", "Anforderung", "Messgrösse"], [["NF-01", "Performance", "Antwortzeit < 2 s bei 95 % der Requests", "p95"], ["NF-02", "Verfügbarkeit", "99.5 % während Bürozeit", "Monatlich"], ["NF-03", "Sicherheit", "Zugriff via SSO / MFA", "Audit"], ["NF-04", "Datenschutz", "Konform zu DSG / DSGVO", "ISDS-Konzept"], ["NF-05", "Skalierbarkeit", "Bis __ User parallel", "Lasttest"]]), H("3. Schnittstellen"), CL("System A ↔ System B (REST / SOAP / Datei)", "AD / SSO", "Monitoring / Logging-Stack"), H("4. Abgrenzungen"), T("Was die Lösung NICHT leisten muss.")]
  }, {
    phase: "konzept",
    icon: "package",
    title: "07 — Systemarchitektur",
    tags: ["hermes", "konzept", "architektur"],
    blocks: p => [T(`Lösungs- und Systemarchitektur für **${p}**.`), H("1. Architekturüberblick"), T("Kurze Beschreibung der Gesamtlösung. Architekturskizze als Bild einfügen."), H("2. Komponenten"), TBL(["Komponente", "Beschreibung", "Technologie", "Verantwortlich"], [["Frontend", "Web-UI", "React / __", "__"], ["Backend / API", "Geschäftslogik", "Java / .NET / __", "__"], ["Datenbank", "Persistenz", "PostgreSQL / __", "__"], ["Integration", "Schnittstellen", "REST / Kafka / __", "__"], ["Auth / IAM", "SSO", "Keycloak / AD / __", "__"]]), H("3. Deployment-Sicht"), S("Umgebungen"), TBL(["Stage", "Zweck", "Verfügbarkeit"], [["DEV", "Entwicklung", "Best effort"], ["INT", "Integration", "Bürozeit"], ["PRE", "Pre-Prod / UAT", "99 %"], ["PROD", "Produktion", "99.5 %"]]), H("4. Daten"), CL("Datenmodell / ER-Diagramm im Anhang", "Personenbezogene Daten: ja / nein", "Datenklassifikation gemäss __"), H("5. Architektur-Entscheide (ADRs)"), TBL(["#", "Entscheid", "Begründung", "Konsequenz"], [["ADR-001", "__", "__", "__"]])]
  }, {
    phase: "konzept",
    icon: "shield",
    title: "08 — ISDS-Konzept (Informationssicherheit & Datenschutz)",
    tags: ["hermes", "konzept", "isds", "datenschutz"],
    blocks: p => [T(`ISDS-Konzept für **${p}**.  Wird mit ISDS-Stelle abgestimmt.`), H("1. Schutzbedarf"), TBL(["Grundwert", "Stufe", "Begründung"], [["Vertraulichkeit", "normal / hoch / sehr hoch", "__"], ["Integrität", "__", "__"], ["Verfügbarkeit", "__", "__"]]), H("2. Daten"), TBL(["Datenkategorie", "Personenbezug", "Klassifikation", "Aufbewahrung"], [["Stammdaten", "ja", "intern", "__"], ["Bewegungsdaten", "ja / nein", "__", "__"], ["Logs / Audit", "indirekt", "intern", "__ Jahre"]]), H("3. Bedrohungen & Massnahmen"), TBL(["Bedrohung", "Auswirkung", "Massnahme", "Restrisiko"], [["Unbefugter Zugriff", "Vertraulichkeitsverlust", "SSO + MFA, RBAC", "tief"], ["Datenverlust", "Verfügbarkeit", "Backup + Restore-Test", "tief"], ["Manipulation", "Integrität", "Audit-Log, Signatur", "tief"]]), H("4. Datenschutz (DSFA)"), CL("Datenschutz-Folgenabschätzung erforderlich? ja / nein", "DSB / DSV informiert", "Auftragsverarbeitung geregelt", "Auskunfts- / Löschrechte technisch umgesetzt"), H("5. Freigabe"), ST("warning"), T("ISDS-Beauftragter: __ (Datum)  ·  Auftraggeber: __ (Datum)")]
  }, {
    phase: "konzept",
    icon: "server",
    title: "09 — Betriebskonzept",
    tags: ["hermes", "konzept", "betrieb"],
    blocks: p => [T(`Betriebskonzept für **${p}**. Übergabe an Betrieb erfolgt im Rahmen der Einführung.`), H("1. Betriebsorganisation"), TBL(["Rolle", "Funktion", "Verantwortlich"], [["Application Manager", "Fachliche Betreuung", "__"], ["Service Manager", "SLA, Eskalation", "__"], ["Operations / 2nd Level", "Betrieb, Updates", "__"], ["Provider / 3rd Level", "Hersteller-Support", "__"]]), H("2. Service Levels"), TBL(["Kennzahl", "Ziel", "Messung"], [["Verfügbarkeit", "99.5 %", "Monitoring"], ["Wiederherstellung (RTO)", "4 h", "Restore-Test"], ["Datenverlust (RPO)", "1 h", "Backup-Konzept"], ["Reaktionszeit Incident P1", "30 min", "Ticketsystem"]]), H("3. Routinetätigkeiten"), CL("Backup täglich", "Patch-Management gemäss Fenster __", "Monitoring + Alerting (Prometheus / __)", "Log-Auswertung monatlich", "Restore-Test halbjährlich"), H("4. Incident- & Problemmanagement"), T("Anbindung an bestehende ITSM-Prozesse (ITIL). Eskalationspfad: 1st → 2nd → 3rd Level."), H("5. Notfall"), T("Verweis auf Notfallkonzept. RTO/RPO siehe oben.")]
  }, {
    phase: "konzept",
    icon: "check-square",
    title: "10 — Testkonzept",
    tags: ["hermes", "konzept", "test"],
    blocks: p => [T(`Teststrategie und -planung für **${p}**.`), H("1. Teststufen"), TBL(["Stufe", "Ziel", "Verantwortlich", "Umgebung"], [["Unit-Test", "Code-Qualität", "Entwickler", "lokal / CI"], ["Integrationstest", "Komponenten zusammen", "Entwicklung", "INT"], ["Systemtest", "Funktional vs. Spec", "Test-Team", "INT / PRE"], ["Abnahmetest (UAT)", "Fachliche Eignung", "Fachbereich", "PRE"], ["Lasttest", "Performance / NFA", "Test-Team", "PRE"], ["Sicherheitstest", "ISDS / Pen-Test", "ISDS / extern", "PRE"]]), H("2. Testarten"), CL("Funktionale Tests (alle MUSS-Anforderungen)", "Regressionstests automatisiert", "Schnittstellentests", "Usability-Test", "Migrationstest (Daten)"), H("3. Testdaten"), T("Anonymisierte Produktivdaten / synthetische Datensätze. Datenschutz beachten."), H("4. Werkzeuge"), TBL(["Zweck", "Tool"], [["Testmanagement", "Xray / TestRail / __"], ["Automatisierung", "Playwright / __"], ["Last", "k6 / JMeter / __"]]), H("5. Eintritts-/Austrittskriterien"), S("Eintritt"), CL("Code build erfolgreich", "Testumgebung verfügbar", "Testdaten vorhanden"), S("Austritt"), CL("Keine offenen Defects Severity 1/2", "Abnahmekriterien erfüllt")]
  }, {
    phase: "konzept",
    icon: "package",
    title: "11 — Migrationskonzept",
    tags: ["hermes", "konzept", "migration"],
    blocks: p => [T(`Migrationskonzept für **${p}**.  Datenübernahme und Umstellungsszenario.`), H("1. Migrationsstrategie"), TBL(["Variante", "Beschreibung", "Vorteile", "Risiken"], [["Big Bang", "Einmalige Umstellung", "kurz, klar", "Rückfall schwierig"], ["Parallel", "Alt + Neu parallel", "Sicher", "doppelter Aufwand"], ["Phasen / Module", "stückweise", "Risiko gestreut", "lange Migration"]]), H("2. Datenmigration"), CL("Quellsysteme identifiziert", "Mapping Quell- ↔ Zielmodell dokumentiert", "Bereinigung der Altdaten geplant", "Test-Migration auf PRE", "Validierungsregeln nach Migration"), H("3. Cut-Over-Plan"), TBL(["Schritt", "Zeit", "Verantwortlich", "Status"], [["Vorbereitung (T-1 Woche)", "__", "PL", "offen"], ["Freeze Altsystem", "__", "Betrieb", "offen"], ["Datenexport", "__", "DBA", "offen"], ["Datenimport ins Neusystem", "__", "Entw.", "offen"], ["Validierung", "__", "Fachbereich", "offen"], ["Go-Live / Freigabe", "__", "AG", "offen"]]), H("4. Rollback"), T("Auslöser-Kriterien und Rückfall-Prozedur definiert.  Entscheid bis T+__ h möglich.")]
  }, {
    phase: "realis",
    icon: "code",
    title: "12 — Detailspezifikation",
    tags: ["hermes", "realisierung", "spezifikation"],
    blocks: p => [T(`Detailspezifikation der Lösung **${p}**. Umsetzung der Anforderungen auf Komponentenebene.`), H("1. Use-Cases / User Stories"), TBL(["ID", "Story", "Akzeptanzkriterien", "Priorität"], [["US-01", "Als __ möchte ich __ damit __", "Gegeben/Wenn/Dann", "MUSS"], ["US-02", "…", "…", "MUSS"]]), H("2. Datenmodell"), T("Entitäten, Attribute, Beziehungen. ER-Diagramm als Bild einfügen."), H("3. API-Spezifikation"), TBL(["Methode", "Pfad", "Beschreibung", "Auth"], [["GET", "/api/items", "Liste", "JWT"], ["POST", "/api/items", "Anlegen", "JWT"], ["GET", "/api/items/{id}", "Detail", "JWT"]]), H("4. UI-Skizzen"), T("Wireframes / Mockups einfügen.  Verweis auf Figma / __."), H("5. Validierungsregeln"), CL("Eingabevalidierung serverseitig", "Fehlerbehandlung definiert", "Audit-Log bei kritischen Aktionen")]
  }, {
    phase: "realis",
    icon: "calendar",
    title: "13 — Realisierungsplan",
    tags: ["hermes", "realisierung", "plan"],
    blocks: p => [T(`Realisierungsplan für **${p}**.  Detail-Planung der Umsetzungsphase.`), H("Iterationsplan"), TBL(["Iteration", "Zeitraum", "Inhalt / User Stories", "Demo"], [["Sprint 1", "__", "US-01, US-02", "__"], ["Sprint 2", "__", "US-03, US-04", "__"], ["Sprint 3", "__", "US-05, NF-01", "__"], ["Hardening", "__", "Bugs, Last- & Sicherheitstest", "__"]]), H("Build & Deploy"), CL("CI-Pipeline eingerichtet", "Code-Reviews Pflicht (≥ 1 Approval)", "Automatisierte Tests in CI", "Deploy auf INT pro Build, PRE auf Knopfdruck"), H("Definition of Done"), CL("Code implementiert + Review", "Unit-Tests grün, Coverage ≥ __ %", "Akzeptanzkriterien erfüllt", "Dokumentation aktualisiert", "Auf INT deployed")]
  }, {
    phase: "realis",
    icon: "doc",
    title: "14 — Systembeschreibung",
    tags: ["hermes", "realisierung", "systembeschreibung"],
    blocks: p => [T(`Systembeschreibung der gebauten Lösung **${p}**.  Wird bei Realisierung aktualisiert.`), H("1. Überblick"), T("Kurzbeschreibung des Systems aus Anwendersicht."), H("2. Aufbau"), T("Komponenten und ihr Zusammenspiel.  Architekturdiagramm einfügen."), H("3. Funktionsumfang"), CL("Hauptfunktion 1", "Hauptfunktion 2", "Hauptfunktion 3"), H("4. Schnittstellen"), TBL(["System", "Richtung", "Format", "Frequenz"], [["__", "ein / aus", "REST/JSON", "Echtzeit"]]), H("5. Konfiguration"), T("Wichtige Parameter, Feature-Flags, Umgebungsvariablen."), H("6. Betrieb"), T("Verweis auf Betriebskonzept und -handbuch.")]
  }, {
    phase: "realis",
    icon: "check-square",
    title: "15 — Testprotokoll",
    tags: ["hermes", "realisierung", "test"],
    blocks: p => [T(`Testprotokoll **${p}**.  Pro Testlauf neu ausgefüllt.`), ST("neutral"), H("Rahmen"), TBL(["Feld", "Wert"], [["Testumgebung", "PRE"], ["Build / Version", "__"], ["Testperiode", "__ – __"], ["Tester", "__"]]), H("Testergebnisse"), TBL(["TC-ID", "Testfall", "Erwartet", "Tatsächlich", "Status"], [["TC-01", "…", "…", "…", "OK"], ["TC-02", "…", "…", "…", "OK"], ["TC-03", "…", "…", "…", "NOK"]]), H("Defects"), TBL(["DEF-ID", "Beschreibung", "Severity", "Status"], [["DEF-01", "__", "Major", "offen"], ["DEF-02", "__", "Minor", "fixed"]]), H("Abschluss"), CL("Alle MUSS-Anforderungen getestet", "Keine offenen Defects Severity 1/2", "Test-Manager freigegeben")]
  }, {
    phase: "einf",
    icon: "globe",
    title: "16 — Einführungskonzept",
    tags: ["hermes", "einführung"],
    blocks: p => [T(`Einführungskonzept für **${p}**.`), H("1. Einführungsstrategie"), CL("Big Bang / Pilot / Wellen", "Standort- / Bereichsweise", "Roll-Back-Strategie definiert"), H("2. Roll-Out-Plan"), TBL(["Welle", "Standort / Bereich", "User", "Datum"], [["1", "Pilot __", "__", "__"], ["2", "Bereich A", "__", "__"], ["3", "Bereich B", "__", "__"]]), H("3. Kommunikation"), TBL(["Zielgruppe", "Kanal", "Termin"], [["Anwender", "Intranet + Mail", "T-4 Wochen"], ["Führung", "Präsentation", "T-6 Wochen"], ["Support", "Schulung", "T-2 Wochen"]]), H("4. Support nach Go-Live"), CL("Hypercare-Phase __ Wochen", "Floorwalking / Hotline", "Schnelle Bug-Fixes via Patch-Pipeline")]
  }, {
    phase: "einf",
    icon: "bookmark",
    title: "17 — Schulungskonzept",
    tags: ["hermes", "einführung", "schulung"],
    blocks: p => [T(`Schulungskonzept für **${p}**.`), H("Zielgruppen"), TBL(["Gruppe", "Inhalt", "Format", "Dauer"], [["Endanwender", "Bedienung", "Präsenz / E-Learning", "1 h"], ["Power-User", "Vertiefung, Admin", "Präsenz", "0.5 d"], ["Support", "Troubleshooting", "Workshop", "1 d"], ["Betrieb", "Operation, Backup, Logs", "Workshop", "0.5 d"]]), H("Materialien"), CL("Anwender-Handbuch", "Quick-Reference / Cheatsheet", "Video-Tutorials", "Test-Umgebung für Übungen"), H("Planung"), TBL(["Termin", "Schulung", "Trainer", "Teilnehmer"], [["__", "Endanwender Welle 1", "__", "__"]])]
  }, {
    phase: "einf",
    icon: "check",
    title: "18 — Abnahmeprotokoll",
    tags: ["hermes", "einführung", "abnahme"],
    blocks: p => [T(`Abnahmeprotokoll für **${p}**.`), ST("warning"), H("Lieferobjekt"), TBL(["Feld", "Wert"], [["Lieferobjekt", `Lösung ${p}`], ["Version / Build", "__"], ["Datum Abnahmetest", "__"], ["Auftraggeber", "__"], ["Auftragnehmer", "__"]]), H("Abnahmekriterien"), CL("Alle MUSS-Anforderungen erfüllt", "Keine offenen Defects Severity 1/2", "Dokumentation vollständig (Architektur, Betrieb, Anwender)", "Schulungen durchgeführt", "ISDS-Freigabe erteilt", "Performance-Anforderungen erfüllt"), H("Festgestellte Mängel"), TBL(["#", "Mangel", "Severity", "Lösungstermin"], [["M-01", "__", "Minor", "__"]]), H("Entscheid"), T("☐ Abnahme erteilt   ☐ Abnahme mit Auflagen   ☐ Abnahme verweigert\n\nBegründung / Auflagen:  __"), H("Unterschriften"), T("Auftraggeber: __  (Datum, Ort, Unterschrift)\nAuftragnehmer: __ (Datum, Ort, Unterschrift)")]
  }, {
    phase: "einf",
    icon: "flag",
    title: "19 — Projektabschlussbericht",
    tags: ["hermes", "einführung", "abschluss"],
    blocks: p => [T(`Projektabschlussbericht **${p}**.  Letztes Lieferobjekt des Projekts.`), H("1. Ergebnis"), T("Was wurde geliefert? Welche Geschäftsziele wurden erreicht?"), H("2. Ziele-Soll/Ist"), TBL(["Ziel", "Soll", "Ist", "Bewertung"], [["Funktionalität", "alle MUSS", "__", "✓ / ✗"], ["Termin", "__", "__", "✓ / ✗"], ["Kosten", "CHF __", "CHF __", "✓ / ✗"], ["Qualität", "__", "__", "✓ / ✗"]]), H("3. Erfahrungen / Lessons Learned"), S("Was war erfolgreich"), CL("…", "…"), S("Was sollte beim nächsten Mal anders sein"), CL("…", "…"), H("4. Empfehlungen für Weiterentwicklung"), CL("Backlog für Folge-Releases", "Offene Anforderungen"), H("5. Projektauflösung"), CL("Team-Mitglieder freigegeben", "Dokumentation abgelegt: __", "Lizenzen / Verträge übergeben an Betrieb", "Restbudget zurück / abgerechnet"), H("6. Freigabe"), ST("success"), T("Auftraggeber bestätigt den Projektabschluss: __ (Datum)")]
  }, {
    phase: "steuerung",
    icon: "type",
    title: "20 — Statusbericht (Vorlage)",
    tags: ["hermes", "steuerung", "status"],
    blocks: p => [T(`Statusbericht **${p}**  ·  Periode: __  ·  Berichtsdatum: __`), H("Status (Ampel)"), ST("success"), TBL(["Dimension", "Status", "Trend", "Bemerkung"], [["Termine", "🟢 / 🟡 / 🔴", "↑ → ↓", "__"], ["Kosten", "🟢", "→", "__"], ["Leistung / Qualität", "🟢", "→", "__"], ["Ressourcen", "🟡", "↓", "__"], ["Risiken", "🟢", "→", "siehe Risikoliste"]]), H("Erreichtes in dieser Periode"), CL("…", "…"), H("Geplant für nächste Periode"), CL("…", "…"), H("Eskalationen / Entscheidungsbedarf"), T("Bei Bedarf eintragen — sonst leer lassen."), H("Top-Risiken & Issues"), T("Detail siehe [[Risikoliste]]."), TBL(["#", "Thema", "Massnahme", "Owner"], [["1", "__", "__", "__"]])]
  }, {
    phase: "steuerung",
    icon: "check-square",
    title: "21 — Sitzungsprotokoll (Vorlage)",
    tags: ["hermes", "steuerung", "protokoll"],
    blocks: p => [T(`Sitzung im Projekt **${p}**`), TBL(["Feld", "Wert"], [["Datum / Zeit", "__"], ["Ort / Tool", "__"], ["Sitzungsleitung", "__"], ["Protokoll", "__"]]), H("Teilnehmende"), T("Anwesend: __\nEntschuldigt: __"), H("Traktanden"), CL("Genehmigung Protokoll letzte Sitzung", "Status & Pendenzen", "Themen / Beschlüsse", "Nächste Schritte"), H("Beschlüsse"), TBL(["#", "Beschluss", "Verantwortlich", "Termin"], [["B-1", "__", "__", "__"]]), H("Pendenzen / Actions"), TBL(["#", "Action", "Owner", "Fällig", "Status"], [["A-1", "__", "__", "__", "offen"]]), H("Nächste Sitzung"), T("Datum / Zeit / Ort: __")]
  }, {
    phase: "steuerung",
    icon: "edit",
    title: "22 — Change-Request",
    tags: ["hermes", "steuerung", "change"],
    blocks: p => [T(`Change-Request im Projekt **${p}**`), TBL(["Feld", "Wert"], [["CR-Nummer", "CR-__"], ["Titel", "__"], ["Antragsteller", "__"], ["Datum Eingang", "__"]]), H("1. Beschreibung der Änderung"), T("Worum geht es?  Warum jetzt nötig?"), H("2. Begründung & Nutzen"), T("Geschäftlicher / technischer Nutzen.  Was passiert, wenn nicht umgesetzt?"), H("3. Auswirkungen"), TBL(["Dimension", "Auswirkung"], [["Leistung / Umfang", "__"], ["Kosten", "+ CHF __"], ["Termine", "+ __ Wochen"], ["Qualität", "__"], ["Risiken", "__"]]), H("4. Alternativen"), CL("Alternative 1 …", "Alternative 2 …", "Keine Umsetzung — Konsequenz: __"), H("5. Empfehlung"), T("Annehmen / Ablehnen / Zurückstellen — Begründung."), H("6. Entscheid"), ST("warning"), T("☐ Genehmigt   ☐ Abgelehnt   ☐ Zurückgestellt\n\nDatum: __  ·  Unterschrift Auftraggeber: __")]
  }];
  const PHASES = [{
    key: "init",
    name: "1 · Initialisierung",
    icon: "flag"
  }, {
    key: "konzept",
    name: "2 · Konzept",
    icon: "edit"
  }, {
    key: "realis",
    name: "3 · Realisierung",
    icon: "code"
  }, {
    key: "einf",
    name: "4 · Einführung",
    icon: "package"
  }, {
    key: "steuerung",
    name: "Steuerung & Protokolle",
    icon: "bookmark"
  }];
  DOCS.forEach((d, i) => {
    if (!d.id) {
      const m = /^(\d{2})/.exec(d.title);
      d.id = m ? m[1] : `d${i}`;
    }
  });
  window.HERMES_CATALOG = {
    phases: PHASES,
    docs: DOCS.map(d => ({
      id: d.id,
      phase: d.phase,
      title: d.title,
      icon: d.icon,
      tags: d.tags
    }))
  };
  const stampIds = blocks => blocks.map(b => {
    const out = {
      ...b,
      id: uid()
    };
    if (b.items) out.items = b.items.map(i => ({
      ...i,
      id: uid()
    }));
    return out;
  });
  window.createHermesProject = function (projectName, options) {
    const name = (projectName || "Neues HERMES-Projekt").trim() || "Neues HERMES-Projekt";
    const opts = options || {};
    const selectedIds = Array.isArray(opts.selectedIds) ? new Set(opts.selectedIds) : null;
    const pickedDocs = selectedIds ? DOCS.filter(d => selectedIds.has(d.id)) : DOCS;
    const rootId = uid();
    const usedPhases = new Set(pickedDocs.map(d => d.phase));
    const activePhases = PHASES.filter(p => usedPhases.has(p.key));
    const phaseFolders = {};
    activePhases.forEach(ph => {
      phaseFolders[ph.key] = uid();
    });
    const folders = [{
      id: rootId,
      name: `📐 HERMES — ${name}`,
      icon: "briefcase",
      parentId: null
    }, ...activePhases.map(ph => ({
      id: phaseFolders[ph.key],
      name: ph.name,
      icon: ph.icon,
      parentId: rootId
    }))];
    const ts = nowIso();
    const notes = pickedDocs.map(d => ({
      id: uid(),
      type: "normal",
      folderId: phaseFolders[d.phase],
      pinned: false,
      title: d.title,
      icon: d.icon,
      tags: d.tags || ["hermes"],
      blocks: stampIds(d.blocks(name)),
      createdAt: ts,
      updatedAt: ts
    }));
    const pinnedTitles = ["02 — Projektauftrag", "03 — Projektmanagementplan (PMP)"];
    notes.forEach(n => {
      if (pinnedTitles.includes(n.title)) n.pinned = true;
    });
    return {
      folders,
      notes,
      rootFolderId: rootId
    };
  };
})();