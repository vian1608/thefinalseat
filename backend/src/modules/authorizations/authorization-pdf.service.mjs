import PDFDocument from 'pdfkit';

export async function generateAuthorizationPdfBuffer(evidence) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const auth = evidence.authorization || {};
      const snapshot = evidence.itinerarySnapshot || {};
      const auditTrail = evidence.auditTrail || [];

      // Header Branding
      doc.rect(40, 40, 515, 60).fill('#7f0d2f');
      doc.fill('#ffffff').fontSize(20).font('Helvetica-Bold').text('THE FINAL SEAT', 55, 52);
      doc.fill('#e2b84d').fontSize(10).font('Helvetica').text('PASSENGER ITINERARY AUTHORIZATION EVIDENCE EXPORT', 55, 78);

      doc.fill('#1e293b');

      // Title & Booking Reference
      doc.fontSize(14).font('Helvetica-Bold').text(`Confirmation Code: ${evidence.confirmationCode || 'N/A'}`, 40, 115);
      doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(`Generated On: ${new Date().toUTCString()} | Evidence ID: ${evidence.evidenceId || 'N/A'}`, 40, 133);
      doc.fillColor('#1e293b');

      // Status Badge
      doc.rect(40, 150, 515, 26).fill('#f8fafc').stroke('#cbd5e1');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#065f46').text(`AUTHORIZATION STATUS: ${auth.status || 'ACCEPTED'}`, 50, 158);
      doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(`Accepted At: ${auth.acceptedAt || 'N/A'}`, 340, 158);
      doc.fillColor('#1e293b');

      let y = 190;

      // Section 1: Passenger & Contact Info
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#7f0d2f').text('1. PASSENGER & CONTACT INFORMATION', 40, y);
      doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, y + 14).lineTo(555, y + 14).stroke();
      y += 22;

      doc.fontSize(9).font('Helvetica').fillColor('#334155');
      doc.text(`Primary Passenger: ${evidence.passengerName || 'N/A'}`, 40, y);
      doc.text(`Contact Email: ${evidence.customerEmail || 'N/A'}`, 300, y);
      y += 15;
      doc.text(`Client IP Address: ${auth.clientIp || 'N/A'}`, 40, y);
      doc.text(`User Agent: ${String(auth.userAgent || 'N/A').substring(0, 45)}...`, 300, y);
      y += 25;

      // Section 2: Itinerary Snapshot
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#7f0d2f').text('2. ITINERARY SNAPSHOT', 40, y);
      doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, y + 14).lineTo(555, y + 14).stroke();
      y += 22;

      const outboundSegs = snapshot.outboundSegments || (snapshot.outbound ? [snapshot.outbound] : []);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e3a5f').text('Outbound Journey:', 40, y);
      y += 14;

      doc.fontSize(9).font('Helvetica').fillColor('#334155');
      outboundSegs.forEach((seg, idx) => {
        const line = `Flight #${idx + 1}: ${seg.carrier_name || seg.airline} ${seg.flight_number || seg.flightNumber} | ${seg.origin_airport || seg.originCode} -> ${seg.destination_airport || seg.destinationCode} | Date: ${seg.departure_date || seg.departureDate} ${seg.departure_time || seg.departureTime} (${seg.cabin || seg.cabinClass || 'Economy'})`;
        doc.text(line, 50, y);
        y += 14;
      });

      const returnSegs = snapshot.returnSegments || (snapshot.return ? [snapshot.return] : []);
      if (returnSegs.length > 0) {
        y += 6;
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#9f1239').text('Return Journey:', 40, y);
        y += 14;
        doc.fontSize(9).font('Helvetica').fillColor('#334155');
        returnSegs.forEach((seg, idx) => {
          const line = `Flight #${idx + 1}: ${seg.carrier_name || seg.airline} ${seg.flight_number || seg.flightNumber} | ${seg.origin_airport || seg.originCode} -> ${seg.destination_airport || seg.destinationCode} | Date: ${seg.departure_date || seg.departureDate} ${seg.departure_time || seg.departureTime} (${seg.cabin || seg.cabinClass || 'Economy'})`;
          doc.text(line, 50, y);
          y += 14;
        });
      }

      y += 15;

      // Section 3: Fare & Payment Details
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#7f0d2f').text('3. FARE & MASKED PAYMENT METHOD', 40, y);
      doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, y + 14).lineTo(555, y + 14).stroke();
      y += 22;

      doc.fontSize(9).font('Helvetica').fillColor('#334155');
      doc.text(`Authorized Amount: $${evidence.authorizedAmount || 0} ${evidence.currency || 'USD'}`, 40, y);
      doc.text(`Masked Payment Card: ${evidence.cardBrand || 'Visa'} ending in ${evidence.cardLast4 || '4242'}`, 300, y);
      y += 25;

      // Section 4: Authorization Text Wording & SHA-256 Hash
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#7f0d2f').text('4. AUTHORIZATION TEXT & CRYPTOGRAPHIC HASH', 40, y);
      doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, y + 14).lineTo(555, y + 14).stroke();
      y += 22;

      doc.fontSize(8).font('Helvetica-Oblique').fillColor('#475569');
      doc.text(`"${evidence.authorizationWording || 'Passenger confirmed itinerary and authorized charge.'}"`, 40, y, { width: 515 });
      y += 35;

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#1e293b');
      doc.text(`SHA-256 Text Hash: ${auth.textHash || 'N/A'}`, 40, y);
      doc.text(`Token ID: ${auth.tokenId || 'N/A'}`, 40, y + 12);
      y += 30;

      // Section 5: Audit Timeline
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#7f0d2f').text('5. COMPREHENSIVE AUDIT TIMELINE', 40, y);
      doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, y + 14).lineTo(555, y + 14).stroke();
      y += 22;

      doc.fontSize(8).font('Helvetica').fillColor('#334155');
      auditTrail.forEach((evt) => {
        doc.text(`[${evt.timestamp}] ${evt.eventType} — ${evt.actor || 'System'} | ${evt.details || ''}`, 40, y);
        y += 12;
      });

      // Disclaimer Footer
      doc.fontSize(7).font('Helvetica').fillColor('#94a3b8').text('This document contains verified PCI-compliant cryptographic evidence recorded by The Final Seat LLC. Raw card numbers and CVCs are never stored or included.', 40, 780, { align: 'center' });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
