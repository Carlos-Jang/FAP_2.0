/**
 * 텍스트 정규화 유틸리티 함수들
 */

/**
 * 파트 이름이 특정 파트와 일치하는지 확인 (대괄호 무시)
 * @param partName 확인할 파트 이름
 * @param targetPart 대상 파트 이름
 * @returns 일치 여부
 */
export const isPartMatch = (partName: string, targetPart: string): boolean => {
  const normalizeTextForComparison = (text: string): string => {
    return text.replace(/[\[\]]/g, '').toLowerCase().trim();
  };
  return normalizeTextForComparison(partName) === normalizeTextForComparison(targetPart);
}; 