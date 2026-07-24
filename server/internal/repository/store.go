package repository

import (
	"scrauto/server/internal/model"

	"gorm.io/gorm"
)

type Store struct {
	DB *gorm.DB
}

func (s *Store) CreateUser(user *model.User) error {
	return s.DB.Create(user).Error
}

func (s *Store) FindUserByEmail(email string) (*model.User, error) {
	var user model.User
	if err := s.DB.Where("email = ?", email).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *Store) FindUserByID(id uint) (*model.User, error) {
	var user model.User
	if err := s.DB.First(&user, id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *Store) ListScores(userID uint) ([]model.Score, error) {
	var scores []model.Score
	err := s.DB.Where("user_id = ?", userID).Order("created_at desc").Find(&scores).Error
	return scores, err
}

func (s *Store) CreateScore(score *model.Score) error {
	return s.DB.Create(score).Error
}

func (s *Store) FindScore(userID, id uint) (*model.Score, error) {
	var score model.Score
	if err := s.DB.Where("user_id = ? AND id = ?", userID, id).First(&score).Error; err != nil {
		return nil, err
	}
	return &score, nil
}

func (s *Store) UpdateScore(score *model.Score) error {
	return s.DB.Save(score).Error
}

func (s *Store) DeleteScore(score *model.Score) error {
	return s.DB.Delete(score).Error
}
