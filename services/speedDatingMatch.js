// services/speedDatingMatch.js
//
// Núcleo de la lógica de rondas del piloto de speed dating (Mila Rooftop):
// las mujeres están siempre sentadas en su mesa fija (nunca se mueven), y
// los hombres rotan de mesa en mesa ronda a ronda — esto no existía en el
// repo, se construye desde cero para este feature (ver propuesta técnica
// v2, sección de algoritmo de rotación).
//
// Fórmula: CICLO = máximo(cantidad de mujeres, cantidad de hombres). Se
// generan CICLO rondas con el "método del círculo" aplicado de forma
// bipartita: las W mujeres ocupan posiciones fijas 0..W-1 (su mesa es
// posición+1), y en la ronda r (0-indexed) la mesa t recibe al hombre que
// esté en la posición rotante (t + r) % CICLO — si esa posición cae fuera
// del rango de hombres reales (puede pasar cuando M < W), esa mesa
// descansa esa ronda (man_id = null); si CICLO = M > W, en cada ronda
// sobran (M - W) hombres sin mesa esa ronda (bye), y por la rotación cada
// hombre termina descansando el mismo número de rondas a lo largo del
// evento — nadie descansa siempre ni nunca.
//
// Esta misma fórmula es la que reutiliza el endpoint de estado en vivo
// (routes/speedDating.js, GET /attendee/:token/estado) para calcular "mi
// mesa esta ronda" sin tener que mantener lógica de rotación duplicada.

/**
 * @param {{id:string}[]} women  mujeres en orden de registro (índice = mesa fija - 1)
 * @param {{id:string}[]} men    hombres en orden de registro (índice = seat_index)
 * @returns {{ totalRounds:number, pairings: Array<{round:number, table:number, womanId:string, manId:string|null}> }}
 */
function generateSchedule(women, men) {
  const W = women.length;
  const M = men.length;
  const CICLO = Math.max(W, M, 1);

  const pairings = [];
  for (let r = 0; r < CICLO; r++) {
    for (let t = 0; t < W; t++) {
      const seatIndex = (t + r) % CICLO;
      const manId = seatIndex < M ? men[seatIndex].id : null;
      pairings.push({
        round: r + 1,
        table: t + 1,
        womanId: women[t].id,
        manId,
      });
    }
  }
  return { totalRounds: CICLO, pairings };
}

module.exports = { generateSchedule };

// ── Cálculo de matches mutuos (vive aquí para que tanto el informe
// inmediato del organizador como el cierre del evento usen exactamente la
// misma consulta — nunca dos definiciones de "match" que puedan divergir).
// Un match mutuo es un pairing (mesa+ronda) donde la mujer Y el hombre de
// esa mesa votaron "si", ambos de forma independiente sin ver el voto del
// otro (ver routes/speedDatingPublic.js, POST /attendee/:token/vote).

const db = require("../db/init");

function computeMutualMatches(eventId) {
  return db
    .prepare(
      `SELECT p.id AS pairing_id, p.round_number, p.table_number, p.woman_id, p.man_id,
              w.name AS woman_name, m.name AS man_name
       FROM sd_pairings p
       JOIN sd_votes vw ON vw.pairing_id = p.id AND vw.voter_attendee_id = p.woman_id AND vw.vote = 'si'
       JOIN sd_votes vm ON vm.pairing_id = p.id AND vm.voter_attendee_id = p.man_id AND vm.vote = 'si'
       JOIN sd_attendees w ON w.id = p.woman_id
       JOIN sd_attendees m ON m.id = p.man_id
       WHERE p.event_id = ? AND p.man_id IS NOT NULL
       ORDER BY p.round_number ASC`
    )
    .all(eventId);
}

// Guarda los matches mutuos calculados en sd_matches (idempotente — se
// puede llamar varias veces sin duplicar, gracias al UNIQUE(event_id,
// woman_id, man_id)). Se llama al finalizar el evento.
function persistMatches(eventId) {
  const matches = computeMutualMatches(eventId);
  const insert = db.prepare(
    `INSERT OR IGNORE INTO sd_matches (id, event_id, woman_id, man_id, table_number, round_number, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const now = new Date().toISOString();
  const tx = db.transaction((rows) => {
    for (const r of rows) {
      insert.run(
        `${eventId}-${r.woman_id}-${r.man_id}`,
        eventId,
        r.woman_id,
        r.man_id,
        r.table_number,
        r.round_number,
        now
      );
    }
  });
  tx(matches);
  return matches.length;
}

module.exports.computeMutualMatches = computeMutualMatches;
module.exports.persistMatches = persistMatches;
