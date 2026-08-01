import { request } from './api';

export interface QuestionOption {
  text: string;
  score: number;
}
export interface Question {
  id: number;
  dimension_id: number;
  question: string;
  options: QuestionOption[];
}
export interface Questionnaire {
  id: number;
  stage: string;
  level?: string; // L1-L6 分龄档位
  title: string;
  questions: string; // JSON string
}
export interface AnswerInput {
  question_id: number;
  dimension_id: number;
  score: number;
}

export async function getQuestionnaire(stage: string, level?: string): Promise<Questionnaire> {
  return request<Questionnaire>({
    method: 'GET',
    url: `/questionnaires/${stage}`,
    params: level ? { level } : undefined,
  });
}

export async function submitQuestionnaire(
  questionnaireId: number,
  stage: string,
  childId: number,
  answers: AnswerInput[],
): Promise<{ reward: number }> {
  return request<{ reward: number }>({
    method: 'POST',
    url: '/questionnaires/submit',
    data: { questionnaire_id: questionnaireId, stage, child_id: childId, answers },
  });
}
