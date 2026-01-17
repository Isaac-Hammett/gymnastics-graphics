import { useEffect, useState, useCallback, useMemo } from 'react';
import { db, ref, onValue } from '../lib/firebase';
import { SERVER_URL } from '../lib/serverUrl';

// VM Status constants matching server-side
export const VM_STATUS = {
  AVAILABLE: 'available',
  ASSIGNED: 'assigned',
  IN_USE: 'in_use',
  STOPPED: 'stopped',
  STARTING: 'starting',
  STOPPING: 'stopping',
  ERROR: 'error',
};

/**
 * useVMPool - Hook for managing VM pool state and actions
 *
 * Subscribes to vmPool/ in Firebase for real-time updates
 * Provides actions for starting, stopping, assigning, and releasing VMs
 *
 * @returns {Object} VM pool state and actions
 */
export function useVMPool() {
  const [vms, setVMs] = useState([]);
  const [poolConfig, setPoolConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Subscribe to vmPool in Firebase
  useEffect(() => {
    const vmsRef = ref(db, 'vmPool/vms');
    const configRef = ref(db, 'vmPool/config');

    let vmsUnsub;
    let configUnsub;

    // Subscribe to VM pool (all VMs under vmPool/vms/)
    vmsUnsub = onValue(vmsRef, (snapshot) => {
      const data = snapshot.val() || {};

      // Convert object to array of VMs
      const vmArray = [];
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object') {
          vmArray.push({
            vmId: key,
            ...value,
          });
        }
      }

      setVMs(vmArray);
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });

    // Subscribe to pool config separately
    configUnsub = onValue(configRef, (snapshot) => {
      setPoolConfig(snapshot.val() || null);
    });

    return () => {
      if (vmsUnsub) vmsUnsub();
      if (configUnsub) configUnsub();
    };
  }, []);

  // Start a VM
  const startVM = useCallback(async (vmId) => {
    try {
      const res = await fetch(`${SERVER_URL}/api/admin/vm-pool/${vmId}/start`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start VM');
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // Stop a VM
  const stopVM = useCallback(async (vmId) => {
    try {
      const res = await fetch(`${SERVER_URL}/api/admin/vm-pool/${vmId}/stop`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to stop VM');
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // Assign a VM to a competition
  const assignVM = useCallback(async (competitionId, preferredVmId = null) => {
    try {
      const body = preferredVmId ? { preferredVmId } : {};

      const res = await fetch(`${SERVER_URL}/api/competitions/${competitionId}/vm/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to assign VM');
      }

      const result = await res.json();
      return { success: true, ...result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // Release a VM from a competition
  const releaseVM = useCallback(async (competitionId) => {
    try {
      const res = await fetch(`${SERVER_URL}/api/competitions/${competitionId}/vm/release`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to release VM');
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // Computed: available VMs (ready for assignment)
  const availableVMs = useMemo(() => {
    return vms.filter(vm => vm.status === VM_STATUS.AVAILABLE);
  }, [vms]);

  // Computed: assigned VMs (linked to a competition)
  const assignedVMs = useMemo(() => {
    return vms.filter(vm =>
      vm.status === VM_STATUS.ASSIGNED ||
      vm.status === VM_STATUS.IN_USE
    );
  }, [vms]);

  // Computed: stopped VMs (cold pool)
  const stoppedVMs = useMemo(() => {
    return vms.filter(vm => vm.status === VM_STATUS.STOPPED);
  }, [vms]);

  // Computed: VMs in error state
  const errorVMs = useMemo(() => {
    return vms.filter(vm => vm.status === VM_STATUS.ERROR);
  }, [vms]);

  // Computed: VMs currently starting or stopping
  const transitioningVMs = useMemo(() => {
    return vms.filter(vm =>
      vm.status === VM_STATUS.STARTING ||
      vm.status === VM_STATUS.STOPPING
    );
  }, [vms]);

  // Helper: get VM assigned to a specific competition
  const getVMForCompetition = useCallback((competitionId) => {
    if (!competitionId) return null;
    return vms.find(vm => vm.assignedTo === competitionId) || null;
  }, [vms]);

  // Helper: check if a competition has a VM assigned
  const hasVMAssigned = useCallback((competitionId) => {
    return !!getVMForCompetition(competitionId);
  }, [getVMForCompetition]);

  // Computed pool statistics
  const poolStats = useMemo(() => {
    return {
      total: vms.length,
      available: availableVMs.length,
      assigned: assignedVMs.length,
      stopped: stoppedVMs.length,
      error: errorVMs.length,
      transitioning: transitioningVMs.length,
    };
  }, [vms, availableVMs, assignedVMs, stoppedVMs, errorVMs, transitioningVMs]);

  return {
    // State
    vms,
    poolConfig,
    loading,
    error,

    // Actions
    startVM,
    stopVM,
    assignVM,
    releaseVM,

    // Computed arrays
    availableVMs,
    assignedVMs,
    stoppedVMs,
    errorVMs,
    transitioningVMs,

    // Helpers
    getVMForCompetition,
    hasVMAssigned,

    // Stats
    poolStats,

    // Re-export VM_STATUS for convenience
    VM_STATUS,
  };
}

export default useVMPool;
