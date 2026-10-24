// Envoi d'emails par SMTP (Brevo, Mailjet, OVH…). Sans SMTP_URL, les emails sont affichés dans la console.

import nodemailer from 'nodemailer';

export function createMailer(config, { log = console.log } = {}) {
  const transport = config.smtpUrl ? nodemailer.createTransport(config.smtpUrl) : null;
  const sent = [];
  return {
    enabled: Boolean(transport),
    sent, // utile pour les tests
    async send({ to, subject, text, html, headers }) {
      const message = { from: config.mailFrom, to, subject, text, html, headers };
      sent.push(message);
      if (!transport) {
        log(`[email non envoyé, SMTP absent] À : ${to} · ${subject}\n${text}\n`);
        return;
      }
      await transport.sendMail(message);
    },
  };
}
