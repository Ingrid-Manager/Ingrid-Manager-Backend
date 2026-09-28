# Ingrid-Manager – Backend

> REST-API-Backend zur Verwaltung von Räumen, Veranstaltungen und Ressourcen, gebaut mit NestJS und TypeScript.
>
> 🌐 [ingrid-manager.de](https://ingrid-manager.de)

![NestJS](https://img.shields.io/badge/NestJS-11.x-e0234e?logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL%20%2F%20MariaDB-8.x%20%2F%2010.6%2B-4479a1?logo=mysql&logoColor=white)
![Lizenz: AGPL v3](https://img.shields.io/badge/Lizenz-AGPL%20v3-blue.svg)

---

## Übersicht

Ingrid-Manager Backend stellt die REST-API für das [Ingrid-Manager-Frontend](https://github.com/Ingrid-Manager/Ingrid-Manager-Frontend) bereit. Es verwaltet Räume, Kalendertermine, Serientermine, Ressourcen und Benutzer, steuert Raumthermostate über FRITZ!Box-Anbindungen und erzeugt Kalenderausdrucke als PDF. Die Endpunkte sind über JWT (Access- und Refresh-Token) und Rollen abgesichert.

Weitere Informationen findest du unter [ingrid-manager.de](https://ingrid-manager.de).

---

## Funktionen

- REST-API für Kalendertermine, Serientermine, Räume, Ressourcen und Ressourcenbuchungen
- JWT-Authentifizierung mit Refresh-Token-Rotation
- Rollenbasierte Zugriffskontrolle (Admin, Verwaltung, Benutzer, Gast)
- Serientermine (wöchentlich / zweiwöchentlich) mit Ferien- und Feiertagslogik
- Monatliche Reorganisation (Ferienimport über openholidaysapi.org, Fortschreiben der Serien)
- Kalendergesteuerte Raumheizung über FRITZ!Box (AHA-Schnittstelle), eine FRITZ!Box je Location
- PDF-Druck (Woche / Monat / Jahr) über einen externen PDF-Render-Server
- Aktivitätsprotokoll (Audit-Log)
- Benutzerverwaltung inkl. Statusverwaltung (Registrierung → Bestätigung → Freischaltung)
- SMTP-Mailversand
- Datenbankanbindung via MySQL / MariaDB

---

## Verwendete Technologien

### Backend

| Bereich | Technologie |
|---------|-------------|
| Framework | NestJS 11 |
| Sprache | TypeScript 5 |
| Laufzeit | Node.js >= 20.11 (empfohlen: Version aus `.nvmrc`) |
| Datenbank | MySQL >= 8 / MariaDB >= 10.6 (TypeORM, Treiber `mysql2`) |
| Authentifizierung | JWT (Passport) |

### Entwicklung

| Bereich | Technologie |
|---------|-------------|
| Linting | ESLint + TypeScript ESLint |
| Formatierung | Prettier |
| Typprüfung | tsc |
| Tests | Jest |
| Commits | Husky + commitlint (Conventional Commits) |

---

## Voraussetzungen

- **Node.js** >= 20.11 (siehe `.nvmrc`)
- **npm** >= 10
- **MySQL** >= 8 oder **MariaDB** >= 10.6 – PostgreSQL wird **nicht** unterstützt (Entities und Migrationen verwenden MySQL-Syntax)
- Eine laufende Instanz des [Ingrid-Manager-Frontends](https://github.com/Ingrid-Manager/Ingrid-Manager-Frontend)
- Optional: ein SMTP-Server (für die Entwicklung z. B. [Maildev](https://github.com/maildev/maildev)) und der externe PDF-Render-Server für die Druckfunktion

---

## Installation & Einrichtung

### 1. Repository klonen

```bash
git clone https://github.com/Ingrid-Manager/Ingrid-Manager-Backend.git
cd Ingrid-Manager-Backend
```

### 2. Abhängigkeiten installieren

```bash
npm ci
```

### 3. Datenbank anlegen

Erstelle eine leere Datenbank in MySQL / MariaDB:

```sql
CREATE DATABASE ingrid_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4. Umgebungsvariablen konfigurieren

Erstelle eine `.env`-Datei im Projektstamm (Vorlage: `env-example-relational`). Mindestens erforderlich:

```env
# Anwendung
NODE_ENV=development
APP_PORT=3000
APP_NAME="Ingrid-Manager"
API_PREFIX=api
APP_FALLBACK_LANGUAGE=de
FRONTEND_DOMAIN=http://localhost:5173
BACKEND_DOMAIN=http://localhost:3000
# Zeitzone des Prozesses (Termine, Serien, Druck und Heizung rechnen in lokaler Zeit)
TZ=Europe/Berlin

# Datenbank (MySQL/MariaDB)
DATABASE_TYPE=mysql
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USERNAME=root
DATABASE_PASSWORD=dein-passwort
DATABASE_NAME=ingrid_manager
DATABASE_SYNCHRONIZE=false

# JWT (jeweils eigene, lange Zufallswerte, z. B. `openssl rand -hex 32`)
AUTH_JWT_SECRET=
AUTH_JWT_TOKEN_EXPIRES_IN=15m
AUTH_REFRESH_SECRET=
AUTH_REFRESH_TOKEN_EXPIRES_IN=30d
AUTH_FORGOT_SECRET=
AUTH_FORGOT_TOKEN_EXPIRES_IN=30m
AUTH_CONFIRM_EMAIL_SECRET=
AUTH_CONFIRM_EMAIL_TOKEN_EXPIRES_IN=1d

# Verschlüsselung gespeicherter Zugangsdaten (genau 32 Byte)
APP_CRYPTO_KEY=

# SMTP
MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_USER=
MAIL_PASSWORD=
MAIL_IGNORE_TLS=true
MAIL_SECURE=false
MAIL_REQUIRE_TLS=false
MAIL_DEFAULT_EMAIL=noreply@example.com
MAIL_DEFAULT_NAME=Ingrid-Manager
```

Weitere, optionale Variablen:

| Variable | Bedeutung |
|----------|-----------|
| `APP_SWAGGER_ENABLED` | Swagger unter `/docs` (Default: nur bei `NODE_ENV=development`) |
| `APP_LOGOURL`, `APP_ICONURL` | Logo und Icon in Mails und Ausdrucken |
| `APP_CRYPTO_PREVIOUS_KEY` | Bisheriger Schlüssel während einer Schlüsselrotation |
| `ORG_NAME`, `ORG_BUNDESLAND`, `ORG_EMAIL`, `ORG_TYPE`, `ORG_WEBSITE` | Angaben zur Organisation (`ORG_BUNDESLAND`, z. B. `NI`, steuert den Ferienimport) |
| `TECH_FIRST_NAME`, `TECH_LAST_NAME`, `TECH_EMAIL` | Technischer Ansprechpartner |
| `PDF_SERVICE_BASE_URL`, `PDF_SERVICE_APP_KEY`, `PDF_SERVICE_CALLBACK_KEY` | Externer PDF-Render-Server (HTTPS; HTTP nur für lokale/private Hosts) |
| `HOLIDAY_CATEGORY_ID`, `HOLIDAY_ROOM_ID` | Kategorie und Raum der importierten Ferien (Default `9999`) |
| `HEATING_SEASON_START`, `HEATING_SEASON_END` | Heizsaison im Format `MM-DD` (beide oder keiner) |
| `HEATING_HALLWAY_ROOM_ID` | Raum-ID(s) der Flure, kommagetrennt, höchstens einer je Location |
| `HEATING_SCHEDULER_ENABLED` | Minütliche Heizungssteuerung (Default `true`) |
| `HEATING_LOG_FILE` | Datei für das ausführliche Fehlerprotokoll der Heizung (Default `logs/heating.log`, `false` schaltet es ab) |
| `HEATING_LOG_FILE_MAX_SIZE_MB` | Dateigröße, ab der nach `<datei>.1` rotiert wird (Default `10`) |
| `DATABASE_URL`, `DATABASE_MAX_CONNECTIONS`, `DATABASE_SSL_ENABLED`, `DATABASE_REJECT_UNAUTHORIZED`, `DATABASE_CA`, `DATABASE_KEY`, `DATABASE_CERT` | Erweiterte Datenbankeinstellungen |

### 5. Migrationen und Stammdaten

```bash
npm run migration:run
npm run seed:run:relational
```

> ⚠️ Der User-Seed legt Beispielkonten mit einem bekannten Passwort an und ist nur für Entwicklungsumgebungen gedacht.

### 6. Entwicklungsserver starten

```bash
npm run start:dev
```

Die API ist anschließend unter `http://localhost:3000/api` erreichbar, ein Health-Check unter `http://localhost:3000/api/health`.

---

## Verfügbare Skripte

| Befehl | Beschreibung |
|--------|--------------|
| `npm run start:dev` | Entwicklungsserver mit Hot-Reload (SWC) starten |
| `npm run build` | Projekt für Produktion bauen (`dist/`, inkl. Vorlagen und Übersetzungen) |
| `npm run start:prod` | Produktionsserver starten (`node dist/main.js`) |
| `npm run check` | TypeScript-Typprüfung ausführen |
| `npm run lint` | ESLint ausführen (`npm run lint -- --fix` korrigiert automatisch) |
| `npm run format` | Alle Dateien mit Prettier formatieren |
| `npm test` / `npm run test:cov` | Unit-Tests (mit Coverage) |
| `npm run migration:run` / `migration:revert` | Migrationen ausführen / zurücknehmen |
| `npm run migration:generate -- src/database/migrations/<Name>` | Migration aus den Entities erzeugen |
| `npm run seed:run:relational` | Stammdaten (Rollen, Status, Beispielnutzer) anlegen |

---

## Projektstruktur

```
src/
├── auth/                 # Authentifizierung (Login, Registrierung, Tokens, Strategien)
├── users/ roles/ statuses/ session/   # Benutzer, Rollen, Status, Sessions
├── rooms/                # Räume (inkl. Heizparameter)
├── calendar-events/      # Einzeltermine
├── series-events/        # Serientermine (Generator, Überschneidung, Ferien)
├── resources/            # Ressourcen
├── resource-events/      # Ressourcenbuchungen
├── categories/           # Kategorie-Entity
├── ownership-transfer/   # Übertragen von Terminen/Serien auf andere Nutzer
├── reorganization/       # Monatliche Reorganisation (Ferienimport, Serien)
├── heating/              # Kalendergesteuerte Raumheizung (Regeln, Scheduler)
├── avm-locations/        # Locations mit FRITZ!Box-Zugangsdaten
├── libs/fritzbox-aha/    # FRITZ!Box-AHA-Bibliothek (kompiliert)
├── print/                # PDF-Druck (Vorlagen, externer Render-Server)
├── audit-log/            # Aktivitätsprotokoll
├── settings/ home/       # Einstellungen, App-Info und Health-Check
├── mail/ mailer/         # Mailversand und Mail-Vorlagen
├── crypto/               # Verschlüsselung gespeicherter Zugangsdaten
├── database/             # TypeORM-Konfiguration, Migrationen, Seeds
├── config/ i18n/ utils/  # Konfiguration, Übersetzungen, Hilfsfunktionen
└── main.ts               # Einstiegspunkt der Anwendung
```

---

## Authentifizierung

Die Authentifizierung erfolgt über zwei Token, die der Login (`POST /api/v1/auth/email/login`) im Response-Body liefert:

- **Access Token** (kurzlebig, z. B. 15 Minuten) – wird bei jeder API-Anfrage im `Authorization`-Header mitgeschickt (`Bearer <token>`)
- **Refresh Token** (langlebig, Laufzeit über `AUTH_REFRESH_TOKEN_EXPIRES_IN`) – wird ebenfalls als `Bearer`-Token an `POST /api/v1/auth/refresh` geschickt und bei jeder Erneuerung rotiert

---

## Rollenmodell

| Rolle | Berechtigungen |
|-------|---------------|
| `admin` | Vollzugriff, inkl. Reorganisation und Eigentümerwechsel |
| `verwaltung` | Verwaltungszugriff: Nutzer, Räume, Ressourcen, Heizung, Aktivitätsprotokoll, alle Termine |
| `user` | Eigene Termine und Buchungen anlegen und bearbeiten |
| `guest` | Nur Lesezugriff |

---

## API-Endpunkte (Auswahl)

Alle Pfade unter dem Prefix `/api`, versioniert über `/v1`. Die vollständige Dokumentation liefert Swagger unter `/docs` (siehe `APP_SWAGGER_ENABLED`).

| Bereich | Endpunkte |
|---------|-----------|
| Auth | `POST auth/email/login`, `POST auth/email/register`, `POST auth/email/confirm`, `POST auth/forgot/password`, `POST auth/reset/password`, `POST auth/refresh`, `POST auth/logout`, `GET/PATCH/DELETE auth/me` |
| Benutzer | `GET/POST users`, `GET/PATCH/DELETE users/:id` |
| Kalendertermine | `POST calendar-events`, `POST calendar-events/range`, `PATCH calendar-events`, `DELETE calendar-events/:id`, `POST calendar-events/print` |
| Serientermine | `GET/POST series-events`, `GET/PATCH/DELETE series-events/:id`, `PATCH series-events/:id/split` |
| Räume | `GET rooms/list`, `GET rooms/names`, `GET rooms/:id`, `POST rooms/create`, `PATCH/DELETE rooms/:id` |
| Ressourcen | `GET resource/list`, `GET resource/names`, `GET resource/:id`, `POST resource/create`, `PATCH resource/:id` |
| Ressourcenbuchungen | `POST resource-events`, `POST resource-events/range`, `PATCH resource-events`, `DELETE resource-events/:id` |
| Heizung | `v1/heating/*` (Diagnose und Thermostatsteuerung), `GET/POST/PATCH avm-locations` |
| Sonstiges | `GET audit-log`, `GET audit-log/:entityType/:entityId`, `POST ownership-transfer`, `POST reorganization/run`, `GET reorganization/holidays`, `GET settings`, `GET settings/version`, `GET health` (unversioniert) |

---

## Betrieb

- **Zeitzone:** Termine, Serien, Druck, Ferienimport und Heizsaison rechnen in der lokalen Zeit des Node-Prozesses. `TZ=Europe/Berlin` setzen.
- **Einzelne Instanz:** Heizungs-Scheduler, Reorganisation und der Zwischenspeicher für Druckaufträge arbeiten prozesslokal. Bei mehreren Instanzen `HEATING_SCHEDULER_ENABLED=true` nur auf einer Instanz setzen.
- **Health-Check:** `GET /api/health` prüft die Datenbankverbindung (HTTP 200 bzw. 503).
- **`DATABASE_SYNCHRONIZE`** in Produktion immer `false`; Schemaänderungen nur über Migrationen.

---

## Mithelfen & Beitragen

Beiträge sind herzlich willkommen! So kannst du mitmachen:

1. Repository forken
2. Feature-Branch erstellen (`git checkout -b feature/mein-feature`)
3. Änderungen committen – auf Englisch nach [Conventional Commits](https://www.conventionalcommits.org/) (`git commit -m 'feat(rooms): add room capacity'`)
4. Branch pushen (`git push origin feature/mein-feature`)
5. Pull Request öffnen

Bitte stelle sicher, dass dein Code Typprüfung, Linting und Tests besteht, bevor du einen Pull Request einreichst:

```bash
npm run check
npm run lint
npm test
```

---


## Autor
**Pascal045**  
**Jonathan Hartmann**  
🌐 [ingrid-manager.de](https://ingrid-manager.de)  
🐙 [@Pascal045](https://github.com/Pascal045)  
🐙 [@JonathanHartmann](https://github.com/JonathanHartmann)  



## Lizenz

Dieses Projekt steht unter der **GNU Affero General Public License v3 (AGPL v3)**.

Das bedeutet:
- Der Quellcode ist frei einsehbar, nutzbar und veränderbar – auch kommerziell
- Wer den Code (verändert oder unverändert) weitergibt, muss ihn ebenfalls unter der AGPL v3 zur Verfügung stellen
- Wer eine veränderte Version als Dienst im Netzwerk betreibt, muss deren Quellcode den Nutzer:innen zugänglich machen
- Der Urheberrechtshinweis und die Lizenzangaben müssen erhalten bleiben
- Es wird **keine Haftung** übernommen

Details siehe [LICENSE](LICENSE) oder [gnu.org/licenses/agpl-3.0](https://www.gnu.org/licenses/agpl-3.0.html).
