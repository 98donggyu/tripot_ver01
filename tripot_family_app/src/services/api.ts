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
        console.log(`API 호출: ${API_BASE_URL}/family/reports/${seniorUserId}`);
        const response = await axios.get(`${API_BASE_URL}/family/reports/${seniorUserId}`);
        console.log('API 응답 데이터:', response.data);
        return response.data;
    } catch (error: any) {
        console.error('리포트를 불러오는 데 실패했습니다:', error);
        if (error.response) {
            console.error('응답 데이터:', error.response.data);
            console.error('응답 상태:', error.response.status);
            console.error('응답 헤더:', error.response.headers);
        } else if (error.request) {
            console.error('요청이 이루어졌지만 응답을 받지 못했습니다:', error.request);
        } else {
            console.error('요청 설정 중 오류 발생:', error.message);
        }
        throw error;
    }
};

// 🔥🔥🔥 ReportScreen을 위한 새로운 함수 추가 (상세 데이터 반환) 🔥🔥🔥
/**
 * 특정 어르신의 상세 리포트 데이터를 가져오는 함수 (ReportScreen용)
 * @param seniorUserId - 조회할 어르신의 고유 ID (user_id_str)
 */
export const getDetailedSeniorReport = async (seniorUserId: string) => {
    try {
        console.log(`API 호출 (상세 리포트): ${API_BASE_URL}/family/reports/detail/${seniorUserId}`);
        const response = await axios.get(`${API_BASE_URL}/family/reports/detail/${seniorUserId}`);
        console.log('API 응답 데이터 (상세 리포트):', response.data);
        return response.data;
    } catch (error: any) {
        console.error('상세 리포트 불러오는 데 실패했습니다:', error);
        if (error.response) {
            console.error('응답 데이터:', error.response.data);
            console.error('응답 상태:', error.response.status);
            console.error('응답 헤더:', error.response.headers);
        } else if (error.request) {
            console.error('요청이 이루어졌지만 응답을 받지 못했습니다:', error.request);
        } else {
            console.error('요청 설정 중 오류 발생:', error.message);
        }
        throw error;
    }
};