#!/usr/bin/env node
// scripts/simular-seguimiento.js
//
// Lista a quién le tocaría el correo de seguimiento de la sesión gratuita.
// SOLO LEE: no envía correos ni modifica la base.
//
//   node scripts/simular-seguimiento.js
//   DB_PATH=/var/data/relateready.sqlite node scripts/simular-seguimiento.js
//
// En Render: pestaña Shell del servicio → el mismo comando (la base ya está
// configurada allí).
const { simulate } = require("../services/sessionNudgeScheduler");

const sim = simulate();
const line = (i) => `  - ${i.name || "(sin nombre)"} <${i.email}> | ${i.lang} | desbloqueó ${String(i.unlockedAt).slice(0, 16)} (${i.hoursSinceUnlock} h) | plazo ${i.until}${i.campaign ? " | " + i.campaign : ""}`;

console.log(`Interruptor SESSION_NUDGE_ENABLED: ${sim.switchOn ? "ENCENDIDO" : "apagado"}`);
console.log(`Pausa desde el panel: ${sim.paused ? "EN PAUSA" : "no"}`);
console.log(`Correo automático configurado: ${sim.mailConfigured ? "sí" : "no"}`);
console.log(`Última sincronización con Bookings: ${sim.sync.lastSyncAt || "nunca"}${sim.sync.lastSyncAt ? ` (hace ${sim.sync.ageHours.toFixed(1)} h, ${sim.sync.fresh ? "al día" : "DESACTUALIZADA"})` : ""}`);
console.log(`Personas con informe desbloqueado: ${sim.unlockedTotal}\n`);
console.log(`Recibirían el PRIMER correo (${sim.first.length}):`);
sim.first.forEach((i) => console.log(line(i)));
console.log(`\nRecibirían el SEGUNDO aviso (${sim.second.length}):`);
sim.second.forEach((i) => console.log(line(i)));
console.log(`\nYa enviados (${sim.sent.length}):`);
sim.sent.forEach((i) => console.log(`  - ${i.name || "(sin nombre)"} <${i.email}> | primer correo ${i.first || "-"} | segundo aviso ${i.second || "-"}`));
console.log("\nNo reciben:");
Object.entries(sim.excluded).forEach(([k, v]) => console.log(`  - ${k}: ${v}`));
console.log("\n(Simulación: no se envió nada.)");
