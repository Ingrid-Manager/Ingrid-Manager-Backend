# AVM AHA Client - Roadmap

## Status

Die Library befindet sich aktuell im produktionsfähigen Zustand für das HeatingModule.

### Bereits umgesetzt

- [x] MD5 Login
- [x] PBKDF2 Login (FRITZ!OS >= 7.5 / 8.x)
- [x] SID Cache
- [x] Health Check
- [x] Device Discovery
- [x] DeviceDto
- [x] ThermostatDto
- [x] Thermostat lesen
- [x] Solltemperatur setzen
- [x] Komforttemperatur aktivieren
- [x] Eco-Modus aktivieren
- [x] Boostmodus
- [x] Fenster-Offen-Modus

---

# Priorität nach Release

## Architektur

### Mapper vereinheitlichen

Aktuell existieren noch unterschiedliche Mapper-/Parser-Strukturen.

Ziel:

```
XML
 ↓
XmlParser
 ↓
Mapper
 ↓
DTO
```

Aufgaben:

- [ ] DeviceListParser entfernen
- [ ] XmlParser als einzigen XML Parser verwenden
- [ ] DeviceMapper vereinheitlichen
- [ ] ThermostatMapper vereinheitlichen
- [ ] BatteryMapper
- [ ] TemperatureMapper
- [ ] SwitchMapper

---

## DTOs erweitern

### DeviceDto

Ergänzen:

- [ ] SwitchDto
- [ ] TemperatureSensorDto
- [ ] HumidityDto
- [ ] PowermeterDto
- [ ] EnergyMeterDto

---

## SmartHome Funktionen

### Thermostate

- [ ] Holiday Mode
- [ ] Summer Mode
- [ ] Frost Protection
- [ ] Device Lock
- [ ] User Lock
- [ ] Preset Temperature

---

### Steckdosen

- [ ] Ein/Aus
- [ ] Toggle
- [ ] Leistung
- [ ] Energieverbrauch
- [ ] Spannung
- [ ] Strom

---

### Sensoren

- [ ] Temperatur
- [ ] Luftfeuchtigkeit
- [ ] Fensterkontakte
- [ ] Taster
- [ ] Bewegungsmelder

---

### Gruppen

- [ ] Gruppen lesen
- [ ] Gruppen schalten
- [ ] Gruppentemperatur

---

### Templates

- [ ] Templates lesen
- [ ] Templates starten

---

## Fehlerbehandlung

- [ ] Automatisches SID Refresh
- [ ] Retry Strategie
- [ ] Timeout Handling
- [ ] Connection Pool
- [ ] Logging über NestJS Logger

---

## Performance

- [ ] Gerätecache
- [ ] Geräteänderungen erkennen
- [ ] SID Refresh im Hintergrund

---

## Testing

### Unit Tests

- [ ] AuthService
- [ ] HttpService
- [ ] DeviceService
- [ ] ThermostatService

### Integration Tests

- [ ] Login
- [ ] Geräte lesen
- [ ] Temperatur setzen
- [ ] Boostmodus
- [ ] Fenstermodus

---

## Dokumentation

- [ ] README
- [ ] API Dokumentation
- [ ] Beispiele

---

## npm Package

Nach erfolgreichem Release der Raumplanung soll die Library als eigenständiges npm-Paket veröffentlicht werden.

Geplante Struktur:

```
@ingridmanager/avm-aha-client
```

Ziele:

- Frameworkunabhängige Core Library
- Optionales NestJS Modul
- Vollständige TypeScript Unterstützung
- Semantische Versionierung
- CI/CD über GitHub Actions

---

## Nicht vor Release umsetzen

Folgende Punkte sind bewusst verschoben worden, da sie für das HeatingModule nicht erforderlich sind:

- Refactoring der Mapper
- Veröffentlichung als npm Package
- Vollständige Testabdeckung
- Erweiterte SmartHome Geräte
- Gruppen
- Templates

Der Fokus liegt zunächst auf der Fertigstellung des HeatingModules und dem produktiven Einsatz der Raumplanung.