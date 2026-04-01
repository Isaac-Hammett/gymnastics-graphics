/**
 * Athlete Grid Block
 *
 * Renders a team roster grid with circular headshot photos.
 * When data.teamKey is provided with a Firebase context, fetches roster and headshots from Firebase.
 * Otherwise renders from data.athletes array directly (preview mode).
 */
window.BlockAthleteGrid = {
  themeVars: ['--meet-overlay-bg', '--meet-overlay-text', '--meet-border-color'],

  sampleData: {
    athletes: [
      { name: 'Alexandra Smith' },
      { name: 'Brianna Johnson' },
      { name: 'Caroline Williams' },
      { name: 'Diana Brown' },
      { name: 'Elizabeth Davis' },
      { name: 'Francesca Miller' },
      { name: 'Gabriella Wilson' },
      { name: 'Hannah Moore' },
      { name: 'Isabella Taylor' },
      { name: 'Julia Anderson' }
    ]
  },

  render: function(container, data, context) {
    var self = this;
    var athletes = (data && data.athletes) || [];
    var teamKey = data && data.teamKey;

    // If teamKey provided with Firebase context, fetch from Firebase
    if (teamKey && context && context.db) {
      self._renderFromFirebase(container, teamKey, context);
    } else {
      // Render directly from data.athletes
      self._renderAthletes(container, athletes);
    }
  },

  _renderFromFirebase: function(container, teamKey, context) {
    var self = this;
    container.innerHTML = '<div class="ag-loading">Loading roster...</div>';

    // Fetch roster and headshots in parallel
    var rosterRef = context.db.ref('teamsDatabase/teams/' + teamKey + '/roster');
    var headshotsRef = context.db.ref('teamsDatabase/headshots');

    Promise.all([
      new Promise(function(resolve) {
        rosterRef.once('value', function(snap) { resolve(snap.val() || []); });
      }),
      new Promise(function(resolve) {
        headshotsRef.once('value', function(snap) { resolve(snap.val() || {}); });
      })
    ]).then(function(results) {
      var roster = results[0];
      var headshots = results[1];

      // Build headshot index with all lookup keys
      var headshotIndex = self._buildHeadshotIndex(headshots);

      // Convert roster to athletes array
      var athletes = roster.map(function(name) {
        return {
          name: name,
          headshot: self._lookupHeadshot(name, headshotIndex)
        };
      });

      self._renderAthletes(container, athletes);
    });
  },

  _renderAthletes: function(container, athletes) {
    var self = this;
    var count = athletes.length;

    if (count === 0) {
      container.innerHTML = '<div class="ag-empty">No roster available</div>';
      return;
    }

    var countClass = self._getCountClass(count);
    var html = '<div class="ag-grid ' + countClass + '">';

    for (var i = 0; i < athletes.length; i++) {
      var athlete = athletes[i];
      var name = athlete.name || '';
      var headshot = athlete.headshot || '';
      var initials = self._getInitials(name);

      html += '<div class="ag-card">';

      if (headshot) {
        html += '<img class="ag-headshot" src="' + _agEscapeHtml(headshot) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';" />';
        html += '<div class="ag-initials" style="display:none;">' + _agEscapeHtml(initials) + '</div>';
      } else {
        html += '<div class="ag-initials">' + _agEscapeHtml(initials) + '</div>';
      }

      html += '<div class="ag-name">' + _agEscapeHtml(name) + '</div>';
      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
  },

  _getCountClass: function(count) {
    if (count <= 6) return 'ag-count-' + count;
    if (count <= 8) return 'ag-count-8';
    if (count <= 10) return 'ag-count-10';
    if (count <= 12) return 'ag-count-12';
    if (count <= 15) return 'ag-count-15';
    if (count <= 20) return 'ag-count-20';
    if (count <= 25) return 'ag-count-25';
    return 'ag-count-large';
  },

  _getInitials: function(name) {
    if (!name) return '?';
    var parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  },

  // ---------- Headshot lookup (5-step fallback chain) ----------

  _buildHeadshotIndex: function(headshots) {
    var index = {};
    var self = this;

    for (var key in headshots) {
      if (headshots.hasOwnProperty(key)) {
        var value = headshots[key];
        if (value && value.url) {
          // Index under multiple key formats for flexible lookup
          var keyWithSpaces = key.toLowerCase().trim().replace(/_/g, ' ').replace(/\s+/g, ' ');
          index[keyWithSpaces] = value.url;

          var normalizedKey = self._normalizeName(key);
          index[normalizedKey] = value.url;

          if (value.name) {
            var nameNormalized = self._normalizeName(value.name);
            index[nameNormalized] = value.url;
            var nameLower = value.name.toLowerCase().trim().replace(/\s+/g, ' ');
            index[nameLower] = value.url;
          }

          var strippedKey = normalizedKey.replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
          if (strippedKey && strippedKey.length > 2) {
            index[strippedKey] = value.url;
          }

          var parts = normalizedKey.split(' ').filter(Boolean);
          if (parts.length >= 3) {
            index[parts[0] + ' ' + parts[parts.length - 1]] = value.url;
            index[parts[0] + ' ' + parts[1][0] + ' ' + parts[parts.length - 1]] = value.url;
          }
        }
      }
    }

    return index;
  },

  _lookupHeadshot: function(athleteName, index) {
    if (!athleteName) return '';
    var self = this;

    var normalized = self._normalizeName(athleteName);
    var stripped = normalized.replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();

    var lookupKeys = [
      athleteName.toLowerCase().replace(/\s+/g, ' ').trim(),
      normalized,
      stripped
    ];

    var parts = normalized.split(' ').filter(Boolean);
    if (parts.length >= 3) {
      lookupKeys.push(parts[0] + ' ' + parts[parts.length - 1]);
      lookupKeys.push(parts[0] + ' ' + parts[1][0] + ' ' + parts[parts.length - 1]);
    }

    // Deduplicate
    var seen = {};
    var uniqueKeys = [];
    for (var i = 0; i < lookupKeys.length; i++) {
      var k = lookupKeys[i];
      if (k && !seen[k]) {
        seen[k] = true;
        uniqueKeys.push(k);
      }
    }

    for (var j = 0; j < uniqueKeys.length; j++) {
      if (index[uniqueKeys[j]]) {
        return index[uniqueKeys[j]];
      }
    }

    return '';
  },

  _normalizeName: function(name) {
    if (!name) return '';
    return this._normalizeAccents(this._removeSuffixes(name))
      .toLowerCase()
      .replace(/[-_]/g, ' ')
      .replace(/[''`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  },

  _normalizeAccents: function(str) {
    if (!str) return '';
    return str
      .replace(/ö/g, 'oe').replace(/Ö/g, 'oe')
      .replace(/ä/g, 'ae').replace(/Ä/g, 'ae')
      .replace(/ü/g, 'ue').replace(/Ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[éèêë]/g, 'e').replace(/[ÉÈÊË]/g, 'e')
      .replace(/[áàâãå]/g, 'a').replace(/[ÁÀÂÃÅ]/g, 'a')
      .replace(/[íìîï]/g, 'i').replace(/[ÍÌÎÏ]/g, 'i')
      .replace(/[óòôõø]/g, 'o').replace(/[ÓÒÔÕØ]/g, 'o')
      .replace(/[úùûü]/g, 'u').replace(/[ÚÙÛÜ]/g, 'u')
      .replace(/ñ/g, 'n').replace(/Ñ/g, 'n')
      .replace(/ç/g, 'c').replace(/Ç/g, 'c')
      .replace(/ÿ/g, 'y').replace(/Ÿ/g, 'y')
      .replace(/æ/g, 'ae').replace(/Æ/g, 'ae')
      .replace(/œ/g, 'oe').replace(/Œ/g, 'oe');
  },

  _removeSuffixes: function(name) {
    if (!name) return '';
    return name
      .replace(/,?\s*(jr\.?|junior|sr\.?|senior|[iv]+|[1-5](?:st|nd|rd|th))$/i, '')
      .trim();
  },

  ready: function() {
    return Promise.resolve();
  }
};

function _agEscapeHtml(str) {
  if (typeof str !== 'string') return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
