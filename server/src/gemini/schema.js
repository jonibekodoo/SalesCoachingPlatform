import { Type } from '@google/genai';

const speaker = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    role: { type: Type.STRING },
    talkTimePercent: { type: Type.NUMBER },
    wordsSpoken: { type: Type.NUMBER },
  },
  required: ['name', 'role', 'talkTimePercent', 'wordsSpoken'],
};

const baseProperties = {
  callSummary: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      duration: { type: Type.STRING },
      durationSeconds: { type: Type.NUMBER },
      speakerA: speaker,
      speakerB: speaker,
      overallScore: { type: Type.NUMBER },
      talkRatio: {
        type: Type.OBJECT,
        properties: { speakerA: { type: Type.NUMBER }, speakerB: { type: Type.NUMBER } },
        required: ['speakerA', 'speakerB'],
      },
      callOutcome: { type: Type.STRING },
      keyStrengthsSummary: { type: Type.STRING },
      primaryRiskSummary: { type: Type.STRING },
    },
    required: [
      'title',
      'duration',
      'durationSeconds',
      'speakerA',
      'speakerB',
      'overallScore',
      'talkRatio',
      'callOutcome',
      'keyStrengthsSummary',
      'primaryRiskSummary',
    ],
  },
  transcript: {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        timestamp: { type: Type.STRING },
        timeSeconds: { type: Type.NUMBER },
        speaker: { type: Type.STRING, enum: ['Speaker A', 'Speaker B'] },
        speakerName: { type: Type.STRING },
        role: { type: Type.STRING, enum: ['Sales Rep', 'Prospect'] },
        text: { type: Type.STRING },
        sentiment: { type: Type.STRING, enum: ['positive', 'neutral', 'negative'] },
        engagementScore: { type: Type.NUMBER },
        keyMoment: { type: Type.STRING },
        coachingFlag: { type: Type.STRING, enum: ['well', 'missed'] },
      },
      required: ['id', 'timestamp', 'timeSeconds', 'speaker', 'speakerName', 'role', 'text', 'sentiment', 'engagementScore'],
    },
  },
  sentimentTimeline: {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        time: { type: Type.STRING },
        timeSeconds: { type: Type.NUMBER },
        speakerAEngagement: { type: Type.NUMBER },
        speakerBEngagement: { type: Type.NUMBER },
        overallEngagement: { type: Type.NUMBER },
        phase: { type: Type.STRING },
        event: { type: Type.STRING },
      },
      required: ['time', 'timeSeconds', 'speakerAEngagement', 'speakerBEngagement', 'overallEngagement', 'phase'],
    },
  },
  coachingCard: {
    type: Type.OBJECT,
    properties: {
      repName: { type: Type.STRING },
      overallGrade: { type: Type.STRING },
      threeThingsDoneWell: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            quote: { type: Type.STRING },
            timestamp: { type: Type.STRING },
            analysis: { type: Type.STRING },
            category: { type: Type.STRING },
            impact: { type: Type.STRING },
          },
          required: ['id', 'title', 'quote', 'timestamp', 'analysis', 'category', 'impact'],
        },
      },
      threeMissedOpportunities: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            quote: { type: Type.STRING },
            timestamp: { type: Type.STRING },
            analysis: { type: Type.STRING },
            category: { type: Type.STRING },
            recommendation: { type: Type.STRING },
            alternativeScript: { type: Type.STRING },
          },
          required: ['id', 'title', 'quote', 'timestamp', 'analysis', 'category', 'recommendation', 'alternativeScript'],
        },
      },
      summaryAdvice: { type: Type.STRING },
      nextActionItems: { type: Type.ARRAY, items: { type: Type.STRING }, minItems: 3 },
      tasks: {
        type: Type.ARRAY,
        minItems: 3,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            why: { type: Type.STRING },
            priority: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
            deadline: { type: Type.STRING },
            category: { type: Type.STRING },
            successCriteria: { type: Type.STRING },
            relatedTimestamp: { type: Type.STRING },
          },
          required: ['id', 'title', 'description', 'why', 'priority', 'deadline', 'category', 'successCriteria'],
        },
      },
    },
    required: ['repName', 'overallGrade', 'threeThingsDoneWell', 'threeMissedOpportunities', 'summaryAdvice', 'nextActionItems', 'tasks'],
  },
};

const FIELD_TYPE_SCHEMA = {
  text: () => ({ type: Type.STRING }),
  number: () => ({ type: Type.NUMBER }),
  boolean: () => ({ type: Type.BOOLEAN }),
  date: () => ({ type: Type.STRING, description: 'ISO date YYYY-MM-DD' }),
  select: (f) => ({ type: Type.STRING, enum: f.options }),
  list: () => ({ type: Type.ARRAY, items: { type: Type.STRING } }),
};

/**
 * Builds the Gemini response schema; CRM custom fields become a `customFields` object
 * with one nullable property per field so the model must answer each one.
 * @param {Array<{key:string,type:string,label:string,description?:string,options?:string[]}>} customFields
 */
const scriptAdherenceSchema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.NUMBER },
    summary: { type: Type.STRING },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          step: { type: Type.STRING },
          required: { type: Type.BOOLEAN },
          status: { type: Type.STRING, enum: ['done', 'partial', 'missed'] },
          evidence: { type: Type.STRING },
          timestamp: { type: Type.STRING },
          comment: { type: Type.STRING },
        },
        required: ['id', 'step', 'status', 'comment'],
      },
    },
    deviations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          timestamp: { type: Type.STRING },
          whatHappened: { type: Type.STRING },
          scriptExpected: { type: Type.STRING },
          impact: { type: Type.STRING },
        },
        required: ['whatHappened', 'scriptExpected'],
      },
    },
    recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['score', 'summary', 'steps', 'deviations', 'recommendations'],
};

// 10-point rating with explicit criteria (script steps when a script is given)
const ratingSchema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.NUMBER },
    verdict: { type: Type.STRING },
    criteria: {
      type: Type.ARRAY,
      minItems: 3,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          score: { type: Type.NUMBER },
          required: { type: Type.BOOLEAN },
          comment: { type: Type.STRING },
        },
        required: ['name', 'score', 'comment'],
      },
    },
  },
  required: ['score', 'verdict', 'criteria'],
};

export function buildAnalysisSchema(customFields = [], { withScript = false } = {}) {
  const properties = { ...baseProperties, rating: ratingSchema };
  const required = ['callSummary', 'transcript', 'sentimentTimeline', 'coachingCard', 'rating'];
  if (withScript) {
    properties.scriptAdherence = scriptAdherenceSchema;
    required.push('scriptAdherence');
  }

  if (customFields.length) {
    const cfProps = {};
    for (const f of customFields) {
      const make = FIELD_TYPE_SCHEMA[f.type] || FIELD_TYPE_SCHEMA.text;
      cfProps[f.key] = { ...make(f), nullable: true, description: f.description || f.label };
    }
    properties.customFields = {
      type: Type.OBJECT,
      properties: cfProps,
      required: customFields.map((f) => f.key),
    };
    required.push('customFields');
  }

  return { type: Type.OBJECT, properties, required };
}
