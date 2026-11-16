# Zalaegerszeg helyi járat szimulátor

Böngészőben futó, 3D-s buszszimulátor Zalaegerszeg belvárosában. Valós
buszmegállókkal, valós helyi járatútvonalakon, elektromos szólóbusszal,
első és harmadik személyű nézettel, GPS-minitérképpel és működő
jelzőlámpákkal.

## Indítás

Kell hozzá **Node.js 18 vagy újabb** (https://nodejs.org/). Telepítés után:

- Windows: kattints duplán az `indito.bat` fájlra, vagy
- parancssorból: `node server.mjs`

A szimulátor ezután a <http://127.0.0.1:8123/> címen nyílik meg. A
`server.mjs` csak statikus fájlokat szolgál ki, nincs függősége.

Közvetlenül `index.html`-ként nem érdemes megnyitni: a böngészők a
`file://` címről nem engedik betölteni az ES-modulokat.

## Irányítás

| Billentyű | Művelet |
| --- | --- |
| `W` / `↑` | gáz |
| `S` / `↓` | fék, majd hátramenet |
| `A` `D` / `←` `→` | kormányzás |
| `Szóköz` | rögzítőfék |
| `C` | első / harmadik személyű nézet |
| `G` | autopilot be/ki |
| `H` | hangos megállóbejelentés be/ki |
| `R` | busz visszaállítása az útvonal elejére |
| egérhúzás | kamera forgatása (harmadik személy) |

A járatot a kezdőképernyőn kártyára kattintva lehet kiválasztani.
Közvetlen hivatkozás is használható: `http://127.0.0.1:8123/?route=20`.

## Megállók és jelzőlámpák

- **Megálló:** állj meg a sárga jelölésnél, 10 méteren belül, 5 km/h alatti
  sebességgel. Az ajtók kinyílnak, a járat 1,7 másodperc után továbbindul,
  a következő megállót a HUD és a hang is bejelenti.
- **Jelzőlámpa:** minden kereszteződés előtt piros. A stopvonalnál megállva
  rövid várakozás után zöldre vált, és a busz mehet. Ez szándékos
  játékmenet-könnyítés: a valós forgalomhoz képest a lámpa mindig a busz
  érkezésére vár.

## Járatok

A belvárosi járatok szerepelnek (a Botfa és a Kökényesmindszent irányú
járatok egyelőre nem):

| Jelzés | Útvonal |
| --- | --- |
| 20 | Kovács Károly tér – Gasparich utca – Landorhegy – Kovács Károly tér (körjárat) |
| 9 | Kertváros – Páterdomb – Tesco – Autóbusz-állomás |
| 18 | Vasútállomás – Széchenyi tér – Kertváros – Kovács Károly tér |
| 3 | Vasútállomás – Kaszaháza – Nekeresd – Pózva |
| 22 | Vasútállomás – Kertváros – Landorhegy – Csácsbozsok |
| 21 | Csácsbozsok – Tesco – Mártírok útja – Kertváros |
| 5 | Kertváros – Kovács Károly tér – Neszele – Ságod |
| 6 | Autóbusz-állomás – Hűtőipari Zrt. – Szenterzsébethegy |
| 25 | Olai bisztró – Kertváros – Kovács Károly tér |
| 29 | Vasútállomás – Kertváros – Landorhegy – Vasútállomás (körjárat) |
| 19A | Kertváros – Kovács Károly tér – Autóbusz-állomás |

## Adatok és jogok

- **Város és megállók:** OpenStreetMap (© OpenStreetMap közreműködők,
  ODbL licenc). Az utak, épületek, zöldfelületek és a 164 valós
  buszmegálló az OSM-ből származik.
- **Útvonalak:** a MÁV-csoport / Volánbusz zalaegerszegi helyi
  menetrendje (2026. szeptember 1.) szerinti járatleírások. A valós
  útvonal-geometriát az OSRM nyilvános útvonaltervezője állítja elő a
  megállók sorrendje alapján.
- **Busz:** eredeti, saját modellezésű alacsonypadlós elektromos szólóbusz,
  a Zalaegerszegen közlekedő BYD elektromos buszok ihletésével. Nem
  tartalmaz gyári védjegyet, logót vagy másolt arculatot.

## Felépítés

```
index.html                  kezdőképernyő és HUD
css/style.css               felület
js/main.js                  jelenet, kamera, játékciklus, HUD
js/city.js                  OSM város -> 3D geometria (utak, épületek, fák)
js/bus.js                   buszmodell és cockpit
js/driver.js                járműfizika, útvonalkövetés, megállólogika
js/traffic.js               jelzőlámpák
js/markers.js               útvonalvonal, megállótáblák, öböljelölés
js/minimap.js               GPS-minitérkép
js/data/zalaegerszeg.js     generált adat (ne szerkeszd kézzel)
tools/build-data.mjs        adatépítő (OSM + OSRM)
raw/                        letöltött nyers OSM adatok
vendor/three.module.js      three.js
server.mjs                  helyi webszerver
```

Az adat újragenerálása (internetkapcsolat kell hozzá):

```
node tools/build-data.mjs
```

## Ismert egyszerűsítések

- A város a valós utcahálózatot követi, de az épületek tömegek, nem
  fotórealisztikus modellek.
- Nincs ütközésdetektálás: a busszal le lehet hajtani a járdára is.
- A forgalom (többi autó, utasok) nem szimulált.
