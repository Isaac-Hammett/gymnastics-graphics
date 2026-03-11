import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db, ref, get, push } from '../lib/firebase';
import { CheckCircleIcon, CalendarIcon } from '@heroicons/react/24/solid';

/**
 * SurveyPage - Public annual talent survey page.
 * URL: /survey/:year (no auth required)
 *
 * Collects: WAG/MAG, competition availability, tech setup, role preference, Discord status.
 * Writes to surveyResponses/{year}/{pushKey} in Firebase (NOT directly to talentRoster).
 */
export default function SurveyPage() {
  const { year } = useParams();
  const [loading, setLoading] = useState(true);
  const [upcomingCompetitions, setUpcomingCompetitions] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    wagMag: '',
    surveyAvailability: {},
    internetUploadMbps: '',
    internetDownloadMbps: '',
    micType: '',
    hasHeadphones: false,
    discordUsername: '',
    commentaryRole: '',
  });

  useEffect(() => {
    loadUpcomingCompetitions();
  }, []);

  async function loadUpcomingCompetitions() {
    try {
      setLoading(true);
      const compsSnapshot = await get(ref(db, 'competitions'));
      if (!compsSnapshot.exists()) {
        setLoading(false);
        return;
      }

      const allComps = compsSnapshot.val();
      const now = new Date();
      const upcoming = Object.entries(allComps)
        .filter(([_, comp]) => {
          const meetDate = comp.config?.meetDate ? new Date(comp.config.meetDate) : null;
          return meetDate && meetDate > now;
        })
        .map(([compId, comp]) => ({
          compId,
          eventName: comp.config?.eventName || 'Unnamed Event',
          meetDate: comp.config?.meetDate || '',
          venue: comp.config?.venue || '',
        }))
        .sort((a, b) => new Date(a.meetDate) - new Date(b.meetDate));

      setUpcomingCompetitions(upcoming);
      setLoading(false);
    } catch (err) {
      console.error('Error loading competitions:', err);
      setLoading(false);
    }
  }

  function handleInputChange(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  function toggleCompetition(compId) {
    setFormData(prev => ({
      ...prev,
      surveyAvailability: {
        ...prev.surveyAvailability,
        [compId]: !prev.surveyAvailability[compId],
      },
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // Basic validation
    if (!formData.name || !formData.email || !formData.wagMag || !formData.commentaryRole) {
      alert('Please fill in all required fields (name, email, WAG/MAG, role preference).');
      return;
    }

    setSubmitting(true);
    try {
      // Write to surveyResponses/{year}/{pushKey}
      const surveyData = {
        name: formData.name,
        email: formData.email,
        wagMag: formData.wagMag,
        surveyAvailability: formData.surveyAvailability,
        internetUploadMbps: parseFloat(formData.internetUploadMbps) || 0,
        internetDownloadMbps: parseFloat(formData.internetDownloadMbps) || 0,
        micType: formData.micType,
        hasHeadphones: formData.hasHeadphones,
        discordUsername: formData.discordUsername,
        commentaryRole: formData.commentaryRole,
        submittedAt: new Date().toISOString(),
        surveyYear: parseInt(year, 10),
      };

      await push(ref(db, `surveyResponses/${year}`), surveyData);
      setSubmitted(true);
    } catch (err) {
      alert(`Error submitting survey: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-gray-400">Loading survey...</div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-gray-800 border border-gray-700 rounded-xl p-6 text-center">
          <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Thank You!</h1>
          <p className="text-gray-400">
            Your survey response has been submitted. We'll be in touch!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            {year} Commentary Talent Survey
          </h1>
          <p className="text-gray-400 mb-8 text-sm">
            Help us coordinate this season's commentary by filling out this survey.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white border-b border-gray-700 pb-2">
                Basic Information
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  WAG / MAG <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.wagMag}
                  onChange={(e) => handleInputChange('wagMag', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  required
                >
                  <option value="">Select...</option>
                  <option value="WAG">WAG</option>
                  <option value="MAG">MAG</option>
                  <option value="Both">Both</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Role Preference <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.commentaryRole}
                  onChange={(e) => handleInputChange('commentaryRole', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  required
                >
                  <option value="">Select...</option>
                  <option value="pbp">Play-by-Play / Lead</option>
                  <option value="analyst">Color / Analyst</option>
                  <option value="both">Either (no preference)</option>
                </select>
              </div>
            </div>

            {/* Competition Availability */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white border-b border-gray-700 pb-2">
                Competition Availability
              </h2>
              <p className="text-sm text-gray-400">
                Check all competitions you're available for:
              </p>

              {upcomingCompetitions.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No upcoming competitions scheduled yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {upcomingCompetitions.map(comp => (
                    <label
                      key={comp.compId}
                      className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                        formData.surveyAvailability[comp.compId]
                          ? 'bg-blue-900/30 border-blue-600'
                          : 'bg-gray-700 border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.surveyAvailability[comp.compId] || false}
                        onChange={() => toggleCompetition(comp.compId)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-white">{comp.eventName}</div>
                        <div className="text-sm text-gray-400 flex items-center gap-2 mt-1">
                          <CalendarIcon className="w-3.5 h-3.5" />
                          {comp.meetDate}
                          {comp.venue && ` · ${comp.venue}`}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Tech Setup */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white border-b border-gray-700 pb-2">
                Tech Setup
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Upload Speed (Mbps)
                  </label>
                  <input
                    type="number"
                    value={formData.internetUploadMbps}
                    onChange={(e) => handleInputChange('internetUploadMbps', e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Download Speed (Mbps)
                  </label>
                  <input
                    type="number"
                    value={formData.internetDownloadMbps}
                    onChange={(e) => handleInputChange('internetDownloadMbps', e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Microphone Type
                </label>
                <input
                  type="text"
                  value={formData.micType}
                  onChange={(e) => handleInputChange('micType', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="e.g., Blue Yeti, Shure SM7B"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasHeadphones}
                    onChange={(e) => handleInputChange('hasHeadphones', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-300">I have headphones for commentary</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Discord Username
                </label>
                <input
                  type="text"
                  value={formData.discordUsername}
                  onChange={(e) => handleInputChange('discordUsername', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="username#1234"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-semibold transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit Survey'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
