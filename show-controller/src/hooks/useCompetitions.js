import { useEffect, useState, useCallback } from 'react';
import { db, ref, onValue, set, update, remove, get } from '../lib/firebase';

export function useCompetitions() {
  const [competitions, setCompetitions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const competitionsRef = ref(db, 'competitions');

    const unsubscribe = onValue(competitionsRef, (snapshot) => {
      setCompetitions(snapshot.val() || {});
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const createCompetition = useCallback(async (compId, config) => {
    try {
      await set(ref(db, `competitions/${compId}/config`), config);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const updateCompetition = useCallback(async (compId, config) => {
    try {
      await update(ref(db, `competitions/${compId}/config`), config);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const deleteCompetition = useCallback(async (compId) => {
    try {
      await remove(ref(db, `competitions/${compId}`));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const duplicateCompetition = useCallback(async (sourceCompId, newCompId) => {
    try {
      const sourceRef = ref(db, `competitions/${sourceCompId}/config`);
      const snapshot = await get(sourceRef);
      const sourceConfig = snapshot.val();

      if (!sourceConfig) {
        return { success: false, error: 'Source competition has no configuration' };
      }

      const duplicateConfig = {
        ...sourceConfig,
        eventName: sourceConfig.eventName ? sourceConfig.eventName + ' (Copy)' : 'Copy'
      };

      await set(ref(db, `competitions/${newCompId}/config`), duplicateConfig);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  return {
    competitions,
    loading,
    error,
    createCompetition,
    updateCompetition,
    deleteCompetition,
    duplicateCompetition,
  };
}

export function useCompetition(compId) {
  const [config, setConfig] = useState(null);
  const [currentGraphic, setCurrentGraphic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!compId) {
      setLoading(false);
      return;
    }

    const configRef = ref(db, `competitions/${compId}/config`);
    const graphicRef = ref(db, `competitions/${compId}/currentGraphic`);

    const unsubConfig = onValue(configRef, (snapshot) => {
      setConfig(snapshot.val());
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });

    const unsubGraphic = onValue(graphicRef, (snapshot) => {
      setCurrentGraphic(snapshot.val());
    });

    return () => {
      unsubConfig();
      unsubGraphic();
    };
  }, [compId]);

  const updateConfig = useCallback(async (updates) => {
    if (!compId) return { success: false, error: 'No competition ID' };
    try {
      await update(ref(db, `competitions/${compId}/config`), updates);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [compId]);

  const setGraphic = useCallback(async (graphic, data = {}) => {
    if (!compId) return { success: false, error: 'No competition ID' };
    try {
      await set(ref(db, `competitions/${compId}/currentGraphic`), {
        graphic,
        data,
        timestamp: Date.now()
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [compId]);

  const clearGraphic = useCallback(async () => {
    return setGraphic('clear', {});
  }, [setGraphic]);

  return {
    config,
    currentGraphic,
    loading,
    error,
    updateConfig,
    setGraphic,
    clearGraphic,
  };
}
