import axios from 'axios';

// 백엔드 서버의 기본 주소입니다.
// 실제 핸드폰에서 테스트 시 '10.0.2.2' 대신 PC의 IP 주소를 사용해야 합니다.
const API_BASE_URL = 'http://192.168.101.67:8080/api/v1';

/**
 * 특정 어르신의 종합 리포트 데이터를 가져오는 함수
 * @param seniorUserId - 조회할 어르신의 고유 ID
 */
export const getSeniorReport = async (seniorUserId: string) => {
    try {
        // ❗️ 중요: 백엔드에 해당 API 엔드포인트가 구현되어 있어야 합니다.
        // GET /api/v1/family/reports/{seniorUserId}
        const response = await axios.get(`${API_BASE_URL}/family/reports/${seniorUserId}`);
        return response.data;
    } catch (error) {
        console.error('리포트를 불러오는 데 실패했습니다:', error);
        // 실제 앱에서는 더 나은 오류 처리가 필요합니다.
        throw error;
    }
};

// 다른 API 함수들도 이곳에 추가할 수 있습니다.
// 예: export const uploadPhoto = async (photoData) => { ... };
