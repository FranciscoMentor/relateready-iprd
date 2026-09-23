// services/speedDatingAttendees.js
//
// Helpers compartidos sobre asistentes de un evento de speed dating, usados
// tanto desde el panel del organizador (routes/speedDatingAdmin.js — editar
// género, eliminar) como desde el flujo público de cancelación (routes/
// speedDatingPublic.js — POST /attendee/:token/cancelar).

const db = require("../db/init");

// Reasigna table_number (solo mujeres — su mesa fija) y seat_index (ambos
// géneros — su posición en la rotación) en orden de registro (created_at),
// cerrando los huecos que deja borrar, cambiar de género, o cancelar la
// participación de un asistente. Los asistentes cancelados (cancelled_at
// IS NOT NULL) se excluyen por completo de la numeración — ya no ocupan
// mesa — pero sus filas se conservan en la base de datos para que el
// organizador vea el motivo. Solo tiene efecto real mientras el evento
// sigue en "registro": una vez generado el calendario de rondas (POST
// /iniciar en routes/speedDatingAdmin.js), la numeración de mesas ya quedó
// fija en sd_pairings y no depende más de estas columnas.
function renumberGender(eventId, gender) {
  const rows = db
    .prepare("SELECT id FROM sd_attendees WHERE event_id = ? AND gender = ? AND cancelled_at IS NULL ORDER BY created_at ASC")
    .all(eventId, gender);
  const update = db.prepare("UPDATE sd_attendees SET table_number = ?, seat_index = ? WHERE id = ?");
  const tx = db.transaction((list) => {
    list.forEach((row, i) => {
      const tableNumber = gender === "F" ? i + 1 : null;
      update.run(tableNumber, i, row.id);
    });
  });
  tx(rows);
}

module.exports = { renumberGender };
