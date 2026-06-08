# Ingrid-Manager – Backend

> REST-API-Backend zur Verwaltung von Räumen, Veranstaltungen und Ressourcen, gebaut mit NestJS und TypeScript.
>
> 🌐 [ingrid-manager.de](https://ingrid-manager.de)

![NestJS](https://img.shields.io/badge/NestJS-10.x-e0234e?logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.x-4479a1?logo=mysql&logoColor=white)
![Lizenz: AGPL v3](https://img.shields.io/badge/Lizenz-AGPL%20v3-blue.svg)

---

## Übersicht

Ingrid-Manager Backend stellt die REST-API für das [Ingrid-Manager-Frontend](https://github.com/Ingrid-Manager/Ingrid-Manager-Frontend) bereit. Es verwaltet Räume, Kalendertermine, Ressourcen und Benutzer und sichert alle Endpunkte über JWT-Authentifizierung mit Refresh-Token-Unterstützung ab.

Weitere Informationen findest du unter [ingrid-manager.de](https://ingrid-manager.de).

---

## Funktionen

- REST-API für Kalendertermine, Räume, Ressourcen und Benutzer
- JWT-Authentifizierung mit Refresh-Token-Rotation
- Rollenbasierte Zugriffskontrolle (Admin, Verwaltung, Benutzer, Gast)
- Serien-Termine
- Benutzerverwaltung inkl. Statusverwaltung
- Raumverwaltung mit Thermostat-/Heizungssteuerung
- Aktivitäten-Logging
- SMTP-Mailversand
- Datenbankanbindung via MySQL / MariaDB

---

## Verwendete Technologien

### Backend

| Bereich | Technologie |
|---------|-------------|
| Framework | NestJS 10 |
| Sprache | TypeScript 5 |
| Laufzeit | Node.js >= 20 |
| Datenbank | MySQL / MariaDB |
| Authentifizierung | JWT |

### Entwicklung

| Bereich | Technologie |
|---------|-------------|
| Linting | ESLint + TypeScript ESLint |
| Formatierung | Prettier |
| Typprüfung | tsc |

---

## Voraussetzungen

- **Node.js** >= 20
- **npm** >= 10
- **MySQL** >= 8 oder **MariaDB** >= 10.6
- Eine laufende Instanz des [Ingrid-Manager-Frontends](https://github.com/Ingrid-Manager/Ingrid-Manager-Frontend)

---

## Installation & Einrichtung

### 1. Repository klonen

```bash
git clone https://github.com/Ingrid-Manager/Ingrid-Manager-Backend.git
cd DEV_IngridManagerBackend
```

### 2. Abhängigkeiten installieren

```bash
npm install
```

### 3. Datenbank anlegen

Erstelle eine leere Datenbank in MySQL / MariaDB:

```sql
CREATE DATABASE ingrid_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4. Umgebungsvariablen konfigurieren

Erstelle eine `.env`-Datei im Projektstamm:

```env
# Anwendung
APP_PORT=3000
NODE_ENV=development

# Datenbank
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USER=root
DATABASE_PASSWORD=dein-passwort
DATABASE_NAME=ingrid_manager

# JWT
AUTH_JWT_SECRET=dein-jwt-secret
AUTH_JWT_TOKEN_EXPIRES_IN=15m
AUTH_REFRESH_SECRET=dein-refresh-secret
AUTH_REFRESH_TOKEN_EXPIRES_IN=7d

# SMTP (optional)
MAIL_HOST=smtp.beispiel.de
MAIL_PORT=587
MAIL_USER=mail@beispiel.de
MAIL_PASSWORD=dein-mail-passwort
MAIL_FROM=mail@beispiel.de
```

### 5. Entwicklungsserver starten

```bash
npm run start:dev
```

Die API ist anschließend unter `http://localhost:3000` erreichbar.

---

## Verfügbare Skripte

| Befehl | Beschreibung |
|--------|--------------|
| `npm run start:dev` | Entwicklungsserver mit Hot-Reload starten |
| `npm run start:prod` | Produktionsserver starten |
| `npm run build` | Projekt für Produktion bauen |
| `npm run type-check` | TypeScript-Typprüfung ausführen |
| `npm run lint` | ESLint ausführen |
| `npm run lint:fix` | ESLint mit automatischer Korrektur ausführen |
| `npm run format` | Alle Dateien mit Prettier formatieren |

---

## Projektstruktur

```
src/
├── auth/                 # Authentifizierung (JWT, Refresh Token, Guards)
├── calendar-events/      # Kalendertermine (CRUD, RRULE-Unterstützung)
├── rooms/                # Raumverwaltung
├── resources/            # Ressourcenverwaltung
├── users/                # Benutzerverwaltung
├── mail/                 # SMTP-Mailversand
├── logs/                 # Aktivitäten-Logging
├── config/               # Konfigurationsmodule (Env, DB, JWT)
└── main.ts               # Einstiegspunkt der Anwendung
```

---

## Authentifizierung

Die Authentifizierung erfolgt über zwei Token:

- **Access Token** (kurzlebig, Standard: 15 Minuten) – wird bei jeder API-Anfrage im `Authorization`-Header mitgeschickt (`Bearer <token>`)
- **Refresh Token** (langlebig, Standard: 7 Tage) – wird als HttpOnly-Cookie gesetzt und dient zur automatischen Erneuerung des Access Tokens

Bei abgelaufenem Access Token sendet der Client automatisch eine Anfrage an `/auth/refresh`, um ein neues Token zu erhalten.

---

## Rollenmodell

| Rolle | Berechtigungen |
|-------|---------------|
| `admin` | Vollzugriff auf alle Endpunkte |
| `verwaltung` | Verwaltungszugriff, kann alle Termine verwalten |
| `user` | Kann eigene Termine erstellen und bearbeiten |
| `guest` | Nur Lesezugriff |

---

## API-Endpunkte

### Authentifizierung

```
POST   /api/v1/auth/email/login       Anmeldung
POST   /api/v1/auth/email/register    Registrierung
POST   /api/v1/auth/logout            Abmeldung
POST   /api/v1/auth/refresh           Access Token erneuern
GET    /api/v1/auth/me                Aktuellen Benutzer abrufen
```

### Kalendertermine

```
POST   /api/v1/calendar-events/range  Termine für Zeitraum laden
POST   /api/v1/calendar-events        Termin erstellen
PATCH  /api/v1/calendar-events        Termin aktualisieren
DELETE /api/v1/calendar-events/:id    Termin löschen
```

### Räume

```
GET    /api/v1/rooms                  Alle Räume abrufen
GET    /api/v1/rooms/names            Raumliste (Name + Farbe)
POST   /api/v1/rooms                  Raum erstellen
PATCH  /api/v1/rooms/:id              Raum aktualisieren
DELETE /api/v1/rooms/:id              Raum löschen
```

### Benutzer

```
GET    /api/v1/users                  Alle Benutzer abrufen
PATCH  /api/v1/users/:id              Benutzer aktualisieren
```

---

## Mithelfen & Beitragen

Beiträge sind herzlich willkommen! So kannst du mitmachen:

1. Repository forken
2. Feature-Branch erstellen (`git checkout -b feature/mein-feature`)
3. Änderungen committen (`git commit -m 'Mein Feature hinzufügen'`)
4. Branch pushen (`git push origin feature/mein-feature`)
5. Pull Request öffnen

Bitte stelle sicher, dass dein Code Linting und Typprüfung besteht, bevor du einen Pull Request einreichst:

```bash
npm run lint
npm run type-check
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
- Der Quellcode ist frei einsehbar, nutzbar und veränderbar
- Wer den Code weitergibt oder verändert, muss das Ergebnis ebenfalls unter AGPL v3 veröffentlichen
- Wer die Software als Dienst im Netzwerk betreibt, muss den Quellcode ebenfalls öffentlich zugänglich machen
- Eine kommerzielle Nutzung ohne Offenlegung des Quellcodes ist **nicht** gestattet
- Der Urheberrechtshinweis und die Autorennennung müssen erhalten bleiben
- Es wird **keine Haftung** übernommen

Details siehe [LICENSE](LICENSE) oder [gnu.org/licenses/agpl-3.0](https://www.gnu.org/licenses/agpl-3.0.html).
