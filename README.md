# Ali-Vitalijs
# Event Agenda (branch `event-agenda`)

Live agenda for the alseda Year-End Conference 2026 (React + Vite).
Landing page with a centered QR code, which opens the agenda timeline (past / now / upcoming).

    npm install
    npm run dev      # local
    npm run build    # static output in dist/

Agenda data: `src/agenda.js`.
Test URL params: `?now=10:40` simulates a time on the event day, `?url=https://...` sets the address encoded in the QR code.
