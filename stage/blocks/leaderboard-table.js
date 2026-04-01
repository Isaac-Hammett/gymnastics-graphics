/**
 * Leaderboard Table Block
 *
 * Renders a scoring leaderboard table with rank, name, team, apparatus, score columns.
 * Column visibility controlled by data.apparatus and data.gender:
 * - Men's events: 8 columns (#, Name, Team, Apparatus, Score, Diff, Exec, SB)
 * - Women's events: 5 columns (#, Name, Team, Apparatus, Score)
 * - All-Around (AA/COMBINED_AA): 4 columns (#, Name, Team, Score)
 */
window.BlockLeaderboardTable = {
  themeVars: [
    '--meet-content-bg',
    '--meet-overlay-bg',
    '--meet-overlay-text',
    '--meet-border-color',
    '--meet-badge-bg',
    '--meet-badge-text'
  ],

  sampleData: {
    apparatus: 'FX',
    gender: 'mens',
    rows: [
      { rank: 1, name: 'Brody Malone', team: 'Stanford', teamLogo: '', score: 14.700, apparatus: 'FX', diff: 6.3, exec: 8.500, stickBonus: true },
      { rank: 2, name: 'Paul Juda', team: 'Michigan', teamLogo: '', score: 14.500, apparatus: 'FX', diff: 6.2, exec: 8.400, stickBonus: false },
      { rank: 2, name: 'Asher Hong', team: 'Stanford', teamLogo: '', score: 14.500, apparatus: 'FX', diff: 6.1, exec: 8.500, stickBonus: true },
      { rank: 4, name: 'Fred Richard', team: 'Michigan', teamLogo: '', score: 14.350, apparatus: 'FX', diff: 6.0, exec: 8.450, stickBonus: false },
      { rank: 5, name: 'Khoi Young', team: 'Stanford', teamLogo: '', score: 14.200, apparatus: 'FX', diff: 5.9, exec: 8.400, stickBonus: true },
      { rank: 6, name: 'Shane Wiskus', team: 'Minnesota', teamLogo: '', score: 14.100, apparatus: 'FX', diff: 5.8, exec: 8.400, stickBonus: false },
      { rank: 7, name: 'Riley Loos', team: 'Oklahoma', teamLogo: '', score: 14.000, apparatus: 'FX', diff: 5.7, exec: 8.400, stickBonus: true },
      { rank: 8, name: 'Curran Phillips', team: 'Stanford', teamLogo: '', score: 13.900, apparatus: 'FX', diff: 5.6, exec: 8.400, stickBonus: false },
      { rank: 9, name: 'Cameron Bock', team: 'Michigan', teamLogo: '', score: 13.800, apparatus: 'FX', diff: 5.5, exec: 8.400, stickBonus: false },
      { rank: 10, name: 'Colt Walker', team: 'Oklahoma', teamLogo: '', score: 13.700, apparatus: 'FX', diff: 5.4, exec: 8.400, stickBonus: true }
    ]
  },

  // Firebase listener reference (for cleanup)
  _listenerRef: null,

  render: function(container, data, context) {
    var rows = (data && data.rows) || [];
    var apparatus = (data && data.apparatus) || 'VT';
    var gender = (data && data.gender) || 'womens';

    // Column visibility
    var isWomens = gender === 'womens';
    var isAA = apparatus === 'AA' || apparatus === 'COMBINED_AA';
    var showDiffExec = !isWomens && !isAA;
    var showApparatus = !isAA;

    // Build rank count map for tie detection
    var rankCounts = {};
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i].rank;
      rankCounts[r] = (rankCounts[r] || 0) + 1;
    }

    // Build table HTML
    var html = '<div class="lb-container">';
    html += '<table class="lb-table">';

    // Header row
    html += '<thead><tr>';
    html += '<th class="lb-col-rank">#</th>';
    html += '<th class="lb-col-name">Name</th>';
    html += '<th class="lb-col-team">Team</th>';
    if (showApparatus) {
      html += '<th class="lb-col-apparatus">Event</th>';
    }
    html += '<th class="lb-col-score">Score</th>';
    if (showDiffExec) {
      html += '<th class="lb-col-diff">Diff</th>';
      html += '<th class="lb-col-exec">Exec</th>';
      html += '<th class="lb-col-sb">SB</th>';
    }
    html += '</tr></thead>';

    // Body rows
    html += '<tbody>';
    for (var j = 0; j < rows.length; j++) {
      var row = rows[j];
      html += '<tr>';

      // Rank column with tie indicator
      var rankDisplay = row.rank;
      if (rankCounts[row.rank] > 1) {
        rankDisplay = row.rank + '<sup>T</sup>';
      }
      html += '<td class="lb-col-rank">' + rankDisplay + '</td>';

      // Name column with medal indicator
      var medalHtml = '';
      if (row.rank === 1) {
        medalHtml = '<span class="lb-place gold"></span>';
      } else if (row.rank === 2) {
        medalHtml = '<span class="lb-place silver"></span>';
      } else if (row.rank === 3) {
        medalHtml = '<span class="lb-place bronze"></span>';
      }
      html += '<td class="lb-col-name">' + medalHtml + _escapeHtml(row.name || '') + '</td>';

      // Team column with logo
      var logoHtml = '';
      if (row.teamLogo) {
        logoHtml = '<img class="lb-team-logo" src="' + _escapeHtml(row.teamLogo) + '" alt="" />';
      }
      html += '<td class="lb-col-team">' + logoHtml + _escapeHtml(row.team || '') + '</td>';

      // Apparatus column
      if (showApparatus) {
        var apparatusDisplay = row.apparatus || apparatus;
        html += '<td class="lb-col-apparatus"><span class="lb-apparatus-badge">' + _escapeHtml(apparatusDisplay) + '</span></td>';
      }

      // Score column
      var scoreDisplay = typeof row.score === 'number' ? row.score.toFixed(3) : (row.score || '');
      html += '<td class="lb-col-score">' + scoreDisplay + '</td>';

      // Diff, Exec, SB columns (men's non-AA only)
      if (showDiffExec) {
        var diffDisplay = typeof row.diff === 'number' ? row.diff.toFixed(2) : (row.diff || '');
        var execDisplay = typeof row.exec === 'number' ? row.exec.toFixed(3) : (row.exec || '');
        html += '<td class="lb-col-diff">' + diffDisplay + '</td>';
        html += '<td class="lb-col-exec">' + execDisplay + '</td>';

        // Stick bonus
        var sbHtml = '';
        if (row.stickBonus) {
          sbHtml = '<span class="lb-stick-bonus">S</span>';
        }
        html += '<td class="lb-col-sb">' + sbHtml + '</td>';
      }

      html += '</tr>';
    }
    html += '</tbody></table></div>';

    container.innerHTML = html;

    // Set up Firebase listener if data.source exists
    if (data && data.source && context && context.db && context.comp) {
      var self = this;
      var sourcePath = 'competitions/' + context.comp + '/' + data.source;
      self._listenerRef = context.db.ref(sourcePath);
      self._listenerRef.on('value', function(snapshot) {
        var liveData = snapshot.val();
        if (liveData && liveData.rows) {
          // Re-render with live data
          self.render(container, Object.assign({}, data, liveData), context);
        }
      });
    }
  },

  destroy: function() {
    if (this._listenerRef) {
      this._listenerRef.off();
      this._listenerRef = null;
    }
  },

  ready: function() {
    return Promise.resolve();
  }
};

function _escapeHtml(str) {
  if (typeof str !== 'string') return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
