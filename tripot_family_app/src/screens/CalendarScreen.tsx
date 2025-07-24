import React, { useState, useMemo } from 'react';
import {
    SafeAreaView, View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, ScrollView, Alert
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';

LocaleConfig.locales['ko'] = {
    monthNames: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
    monthNamesShort: ['1.','2.','3.','4.','5.','6.','7.','8.','9.','10.','11.','12.'],
    dayNames: ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'],
    dayNamesShort: ['일','월','화','수','목','금','토'],
    today: '오늘',
};
LocaleConfig.defaultLocale = 'ko';

interface Event {
    id: string;
    text: string;
    createdAt: Date;
}

interface MarkedDates {
    [key: string]: { 
        marked?: boolean; 
        dotColor?: string; 
        events?: Event[];
    };
}

// App.tsx로부터 받을 props 타입을 정의합니다.
interface CalendarScreenProps {
    navigation: any;
    savedDates: MarkedDates;
    onUpdateEvent: (date: string, events: Event[]) => void;
}

const CalendarScreen = ({ navigation, savedDates, onUpdateEvent }: CalendarScreenProps) => {
    const [selectedDate, setSelectedDate] = useState('');
    const [isModalVisible, setModalVisible] = useState(false);
    const [eventText, setEventText] = useState('');
    
    const todayString = useMemo(() => new Date().toISOString().split('T')[0], []);

    const handleDayPress = (day: any) => {
        const dateString = day.dateString;
        setSelectedDate(dateString);
        setModalVisible(true);
    };

    const handleAddEvent = () => {
        if (eventText.trim() === '') {
            Alert.alert('알림', '일정을 입력해주세요.');
            return;
        }

        const currentEvents = savedDates[selectedDate]?.events || [];
        const newEvent: Event = {
            id: Date.now().toString(), // 간단한 ID 생성
            text: eventText.trim(),
            createdAt: new Date()
        };

        const updatedEvents = [...currentEvents, newEvent];
        onUpdateEvent(selectedDate, updatedEvents);
        
        setEventText('');
        setModalVisible(false); // 모달 닫고 바로 일정 관리 페이지로
    };

    const handleDeleteEvent = (eventId: string) => {
        Alert.alert(
            '일정 삭제',
            '이 일정을 삭제하시겠습니까?',
            [
                { text: '취소', style: 'cancel' },
                {
                    text: '삭제',
                    style: 'destructive',
                    onPress: () => {
                        const currentEvents = savedDates[selectedDate]?.events || [];
                        const updatedEvents = currentEvents.filter(event => event.id !== eventId);
                        onUpdateEvent(selectedDate, updatedEvents);
                    }
                }
            ]
        );
    };

    const getSelectedDateEvents = () => {
        return savedDates[selectedDate]?.events || [];
    };

    const getTodayEvents = () => {
        return savedDates[todayString]?.events || [];
    };

    return (
        <SafeAreaView style={calendarStyles.safeArea}>
            <View style={calendarStyles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={calendarStyles.backButtonText}>‹</Text>
                </TouchableOpacity>
                <Text style={calendarStyles.headerTitle}>일정 관리</Text>
                <View style={{ width: 24 }} />
            </View>

            <Calendar
                onDayPress={handleDayPress}
                markedDates={savedDates}
                monthFormat={'yyyy년 MM월'}
                theme={{
                    selectedDayBackgroundColor: '#00adf5',
                    arrowColor: '#00adf5',
                    dotColor: '#50cebb',
                    todayTextColor: '#00adf5',
                }}
                style={{marginBottom: 10}}
            />
            
            <View style={calendarStyles.todayScheduleContainer}>
                <Text style={calendarStyles.todayDateText}>오늘의 일정 ({todayString})</Text>
                {getTodayEvents().length > 0 ? (
                    <ScrollView style={calendarStyles.eventsScrollView}>
                        {getTodayEvents().map((event, index) => (
                            <View key={event.id} style={calendarStyles.eventItem}>
                                <Text style={calendarStyles.eventNumber}>{index + 1}.</Text>
                                <Text style={calendarStyles.todayScheduleText}>
                                    {event.text}
                                </Text>
                            </View>
                        ))}
                    </ScrollView>
                ) : (
                    <Text style={calendarStyles.noScheduleText}>
                        오늘은 등록된 일정이 없어요.
                    </Text>
                )}
            </View>

            <Modal
                animationType="fade"
                transparent={true}
                visible={isModalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={calendarStyles.centeredView}>
                    <View style={calendarStyles.modalView}>
                        <Text style={calendarStyles.modalDateText}>{selectedDate}</Text>
                        
                        {/* 기존 일정 목록 */}
                        <View style={calendarStyles.existingEventsContainer}>
                            <Text style={calendarStyles.existingEventsTitle}>등록된 일정</Text>
                            <ScrollView style={calendarStyles.existingEventsScroll}>
                                {getSelectedDateEvents().length > 0 ? (
                                    getSelectedDateEvents().map((event, index) => (
                                        <View key={event.id} style={calendarStyles.existingEventItem}>
                                            <View style={calendarStyles.eventContent}>
                                                <Text style={calendarStyles.eventNumber}>{index + 1}.</Text>
                                                <Text style={calendarStyles.existingEventText}>
                                                    {event.text}
                                                </Text>
                                            </View>
                                            <TouchableOpacity 
                                                style={calendarStyles.deleteButton}
                                                onPress={() => handleDeleteEvent(event.id)}
                                            >
                                                <Text style={calendarStyles.deleteButtonText}>삭제</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ))
                                ) : (
                                    <Text style={calendarStyles.noEventsText}>등록된 일정이 없습니다.</Text>
                                )}
                            </ScrollView>
                        </View>

                        {/* 새 일정 추가 */}
                        <View style={calendarStyles.addEventContainer}>
                            <Text style={calendarStyles.addEventTitle}>새 일정 추가</Text>
                            <TextInput
                                style={calendarStyles.input}
                                placeholder="일정을 입력하세요"
                                placeholderTextColor="#999"
                                value={eventText}
                                onChangeText={setEventText}
                            />
                        </View>

                        <View style={calendarStyles.modalButtons}>
                            <TouchableOpacity 
                                style={[calendarStyles.button, calendarStyles.buttonClose]}
                                onPress={() => {
                                    setModalVisible(false);
                                    setEventText('');
                                }}
                            >
                                <Text style={calendarStyles.buttonText}>닫기</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[calendarStyles.button, calendarStyles.buttonSave]}
                                onPress={handleAddEvent}
                            >
                                <Text style={calendarStyles.buttonText}>추가</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const calendarStyles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f5f5f5' },
    header: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        paddingHorizontal: 16, 
        paddingVertical: 12, 
        borderBottomWidth: 1, 
        borderBottomColor: '#EEE', 
        backgroundColor: '#fff' 
    },
    backButtonText: { fontSize: 32, color: '#333', fontWeight: 'bold' },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },
    todayScheduleContainer: { 
        padding: 24, 
        backgroundColor: '#fff', 
        marginHorizontal: 12, 
        borderRadius: 16, 
        shadowColor: "#000", 
        shadowOffset: { width: 0, height: 2 }, 
        shadowOpacity: 0.15, 
        shadowRadius: 3, 
        elevation: 4,
        maxHeight: 220
    },
    todayDateText: { 
        fontSize: 28, 
        fontWeight: 'bold', 
        color: '#555', 
        marginBottom: 10 
    },
    eventsScrollView: {
        maxHeight: 120
    },
    eventItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
        paddingVertical: 4
    },
    eventNumber: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#00adf5',
        marginRight: 12,
        minWidth: 30
    },
    todayScheduleText: { 
        fontSize: 26, 
        fontWeight: '600', 
        color: '#333',
        flex: 1,
        lineHeight: 34
    },
    noScheduleText: { 
        fontSize: 24, 
        color: '#888',
        textAlign: 'center',
        fontWeight: '500'
    },
    centeredView: { 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: 'rgba(0,0,0,0.6)' 
    },
    modalView: { 
        width: '95%', 
        maxHeight: '80%',
        backgroundColor: 'white', 
        borderRadius: 20, 
        padding: 20, 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 2 }, 
        shadowOpacity: 0.25, 
        shadowRadius: 4, 
        elevation: 5 
    },
    modalDateText: { 
        fontSize: 24, 
        fontWeight: 'bold', 
        marginBottom: 15,
        textAlign: 'center',
        color: '#333'
    },
    existingEventsContainer: {
        marginBottom: 20
    },
    existingEventsTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12
    },
    existingEventsScroll: {
        maxHeight: 150,
        backgroundColor: '#f8f8f8',
        borderRadius: 10,
        padding: 10
    },
    existingEventItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 1
    },
    eventContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1
    },
    existingEventText: {
        fontSize: 20,
        color: '#333',
        flex: 1,
        lineHeight: 26
    },
    deleteButton: {
        backgroundColor: '#ff4444',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        minWidth: 60
    },
    deleteButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold'
    },
    noEventsText: {
        textAlign: 'center',
        color: '#888',
        fontSize: 18,
        paddingVertical: 30,
        fontWeight: '500'
    },
    addEventContainer: {
        marginBottom: 20
    },
    addEventTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12
    },
    input: { 
        width: '100%', 
        height: 60, 
        borderColor: '#ccc', 
        borderWidth: 2, 
        borderRadius: 12, 
        paddingHorizontal: 18, 
        fontSize: 20, 
        backgroundColor: '#f9f9f9' 
    },
    modalButtons: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        width: '100%' 
    },
    button: { 
        borderRadius: 12, 
        paddingVertical: 16, 
        paddingHorizontal: 24, 
        elevation: 2, 
        flex: 1, 
        marginHorizontal: 6, 
        alignItems: 'center' 
    },
    buttonClose: { 
        backgroundColor: '#777' 
    },
    buttonSave: { 
        backgroundColor: '#2196F3' 
    },
    buttonText: { 
        color: 'white', 
        fontWeight: 'bold', 
        fontSize: 18 
    }
});

export default CalendarScreen;