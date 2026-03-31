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
    apparatus: 'VT',
    gender: 'womens',
    rows: [
      { rank: 1, name: 'Jade Carey', team: 'Arizona', teamLogo: '', score: 9.975, apparatus: 'VT' },
      { rank: 2, name: 'Sunisa Lee', team: 'Auburn', teamLogo: '', score: 9.950, apparatus: 'VT' },
      { rank: 2, name: 'Jordan Chiles', team: 'UCLA', teamLogo: '', score: 9.950, apparatus: 'VT' },
      { rank: 4, name: 'Trinity Thomas', team: 'Florida', teamLogo: '', score: 9.925, apparatus: 'VT' },
      { rank: 5, name: 'Leanne Wong', team: 'Florida', teamLogo: '', score: 9.900, apparatus: 'VT' },
      { rank: 5, name: 'Kaliya Lincoln', team: 'UCLA', teamLogo: '', score: 9.900, apparatus: 'VT' },
      { rank: 7, name: 'Skye Blakely', team: 'LSU', teamLogo: '', score: 9.875, apparatus: 'VT' },
      { rank: 8, name: 'Hezly Rivera', team: 'LSU', teamLogo: '', score: 9.850, apparatus: 'VT' },
      { rank: 9, name: 'Simone Biles', team: 'World Champions', teamLogo: '', score: 9.825, apparatus: 'VT' },
      { rank: 10, name: 'Morgan Hurd', team: 'Stanford', teamLogo: '', score: 9.800, apparatus: 'VT' }
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
