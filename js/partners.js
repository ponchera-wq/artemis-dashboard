/* ── Commercial partner status cards ── */
(function() {
  const partnersPanel = document.getElementById('partners-panel');

  if (!partnersPanel) return;

  fetch('/data/partners-status.json')
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(partners => {
      if (!Array.isArray(partners) || partners.length === 0) {
        throw new Error('No partner data');
      }

      const container = document.createElement('div');
      container.className = 'partners-container';

      partners.forEach(partner => {
        const card = document.createElement('div');
        card.className = 'partner-card';

        // Header: provider name (dim) + partner name (prominent)
        const header = document.createElement('div');
        header.className = 'partner-card-header';
        header.innerHTML = `
          <span class="partner-provider">${escapeHtml(partner.provider)}</span>
          <span class="partner-name">${escapeHtml(partner.name)}</span>
        `;

        // Vehicle/system description
        const vehicle = document.createElement('div');
        vehicle.className = 'partner-card-vehicle';
        vehicle.textContent = partner.vehicle_or_system;

        // Current status as highlighted pill
        const status = document.createElement('div');
        status.className = 'partner-card-status';
        status.textContent = partner.current_status;

        // Progress bar with readiness label
        const progress = document.createElement('div');
        progress.className = 'partner-card-progress';
        progress.innerHTML = `
          <div class="partner-progress-bar">
            <div class="partner-progress-fill" style="width: ${partner.progress_pct}%"></div>
          </div>
          <span class="partner-readiness">READINESS ~${partner.progress_pct}%</span>
        `;

        // Recent milestone
        const recent = document.createElement('div');
        recent.className = 'partner-card-recent';
        recent.innerHTML = `<strong>Recent:</strong> ${escapeHtml(partner.recent_milestone)}`;

        // Next milestone
        const next = document.createElement('div');
        next.className = 'partner-card-next';
        next.innerHTML = `<strong>Next:</strong> ${escapeHtml(partner.next_milestone)}`;

        // Unblocks capability (italic footnote)
        const unblocks = document.createElement('div');
        unblocks.className = 'partner-card-unblocks';
        unblocks.innerHTML = `<em>Unblocks: ${escapeHtml(partner.unblocks)}</em>`;

        // Source link with icon
        const source = document.createElement('div');
        source.className = 'partner-card-source';
        const sourceLink = document.createElement('a');
        sourceLink.href = partner.source_url;
        sourceLink.target = '_blank';
        sourceLink.rel = 'noopener';
        sourceLink.textContent = '↗ Source';
        source.appendChild(sourceLink);

        card.appendChild(header);
        card.appendChild(vehicle);
        card.appendChild(status);
        card.appendChild(progress);
        card.appendChild(recent);
        card.appendChild(next);
        card.appendChild(unblocks);
        card.appendChild(source);

        container.appendChild(card);
      });

      partnersPanel.appendChild(container);
    })
    .catch(err => {
      console.error('Failed to load partner data:', err);
      partnersPanel.textContent = 'Partner status unavailable';
      partnersPanel.style.display = 'flex';
      partnersPanel.style.alignItems = 'center';
      partnersPanel.style.justifyContent = 'center';
      partnersPanel.style.minHeight = '200px';
      partnersPanel.style.color = 'var(--text-dim)';
    });

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();
