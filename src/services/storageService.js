/**
 * MargDrishti AI LocalStorage Management Service
 * Manages genuinely analyzed road hazards, logs, and analytics.
 */

const STORAGE_KEY = 'margdrishti_hazard_logs_v1';
const SETTINGS_KEY = 'margdrishti_settings_v1';

export const storageService = {
  /**
   * Retrieves all saved hazard records
   */
  getHazards() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error reading localStorage hazards:', e);
      return [];
    }
  },

  /**
   * Saves a new analyzed hazard record
   */
  saveHazard(hazardRecord) {
    try {
      const records = this.getHazards();
      const newRecord = {
        id: hazardRecord.id || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        timestamp: hazardRecord.timestamp || new Date().toISOString(),
        hazardType: hazardRecord.hazardType || 'Road Hazard',
        hazardClass: hazardRecord.hazardClass || 'pothole',
        confidence: hazardRecord.confidence || 0,
        confidencePct: hazardRecord.confidencePct || Math.round((hazardRecord.confidence || 0) * 100),
        severity: hazardRecord.severity || 'MEDIUM',
        riskScore: hazardRecord.riskScore || 50,
        hazardCount: hazardRecord.hazardCount !== undefined ? hazardRecord.hazardCount : 1,
        detections: hazardRecord.detections || [],
        bbox: hazardRecord.bbox || null,
        location: hazardRecord.location || null, // { latitude, longitude, accuracy }
        thumbnail: hazardRecord.thumbnail || null,
        inferenceTimeMs: hazardRecord.inferenceTimeMs || 0,
        modelUsed: hazardRecord.modelUsed || 'MargDrishti Unified AI'
      };

      // Unshift to place newest first
      records.unshift(newRecord);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      return newRecord;
    } catch (e) {
      console.error('Error saving hazard to localStorage:', e);
      return null;
    }
  },

  /**
   * Deletes a record by ID
   */
  deleteHazard(id) {
    try {
      const records = this.getHazards().filter(r => r.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      return true;
    } catch (e) {
      console.error('Error deleting hazard:', e);
      return false;
    }
  },

  /**
   * Clears all saved records
   */
  clearAll() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Computes genuine live statistics from saved records
   */
  getStatistics() {
    const records = this.getHazards();
    const totalAnalyses = records.length;
    
    if (totalAnalyses === 0) {
      return {
        totalAnalyses: 0,
        totalHazardsDetected: 0,
        highRiskHazards: 0,
        avgConfidence: 0,
        typeBreakdown: {},
        severityBreakdown: {
          CRITICAL: 0,
          HIGH: 0,
          MEDIUM: 0,
          LOW: 0
        },
        hasGPSCount: 0,
        recentRecords: []
      };
    }

    let totalHazardsCount = 0;
    let highRiskCount = 0;
    let totalConfidence = 0;
    let hasGPSCount = 0;

    const typeBreakdown = {};
    const severityBreakdown = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0
    };

    records.forEach(r => {
      const isConfirmedHazard = r.hazardClass !== 'clear' && r.hazardCount > 0;
      if (isConfirmedHazard) {
        totalHazardsCount += (r.hazardCount || 1);
        if (r.severity === 'CRITICAL' || r.severity === 'HIGH') {
          highRiskCount++;
        }
        const typeKey = r.hazardType || 'Unknown';
        typeBreakdown[typeKey] = (typeBreakdown[typeKey] || 0) + 1;
      }

      totalConfidence += (r.confidence || 0);

      if (severityBreakdown[r.severity] !== undefined) {
        severityBreakdown[r.severity]++;
      }

      if (r.location && r.location.latitude && r.location.longitude) {
        hasGPSCount++;
      }
    });

    return {
      totalAnalyses,
      totalHazardsDetected: totalHazardsCount,
      highRiskHazards: highRiskCount,
      avgConfidence: Math.round((totalConfidence / totalAnalyses) * 100),
      typeBreakdown,
      severityBreakdown,
      hasGPSCount,
      recentRecords: records.slice(0, 5)
    };
  }
};
