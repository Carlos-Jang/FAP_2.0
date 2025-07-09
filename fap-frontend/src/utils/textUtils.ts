/**
 * 텍스트 정규화 유틸리티 함수들
 */

/**
 * 대괄호 제거 및 기본 정규화
 * @param text 정규화할 텍스트
 * @returns 정규화된 텍스트
 */
export const normalizeText = (text: string): string => {
  return text.replace(/[\[\]]/g, '').trim();
};

/**
 * 대괄호 제거, 소문자 변환, 공백 정리 (대소문자 구분 없는 비교용)
 * @param text 정규화할 텍스트
 * @returns 정규화된 텍스트 (소문자)
 */
export const normalizeTextForComparison = (text: string): string => {
  return text.replace(/[\[\]]/g, '').toLowerCase().trim();
};

/**
 * 파트 이름이 특정 파트와 일치하는지 확인 (대괄호 무시)
 * @param partName 확인할 파트 이름
 * @param targetPart 대상 파트 이름
 * @returns 일치 여부
 */
export const isPartMatch = (partName: string, targetPart: string): boolean => {
  return normalizeTextForComparison(partName) === normalizeTextForComparison(targetPart);
}; 