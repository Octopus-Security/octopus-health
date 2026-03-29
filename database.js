const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// User data is now handled by octopus-auth service
// This file only handles health-specific data models

const getDatabase = (username) => {
    const sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: path.join(__dirname, 'data', `${username}_health.sqlite`),
        logging: false
    });

    // Weight tracking
    const WeightEntry = sequelize.define('WeightEntry', {
        date: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        weight: {
            type: DataTypes.FLOAT,
            allowNull: false
        },
        unit: {
            type: DataTypes.ENUM('kg', 'lbs'),
            allowNull: false,
            defaultValue: 'lbs'
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    });

    // Exercise tracking
    const Exercise = sequelize.define('Exercise', {
        date: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false
        },
        duration: {
            type: DataTypes.INTEGER, // minutes
            allowNull: false
        },
        calories: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        distance: {
            type: DataTypes.FLOAT, // miles or km
            allowNull: true
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    });

    // Food/Meal tracking
    const Meal = sequelize.define('Meal', {
        date: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        time: {
            type: DataTypes.TIME,
            allowNull: false
        },
        mealType: {
            type: DataTypes.ENUM('breakfast', 'lunch', 'dinner', 'snack'),
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        calories: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        protein: {
            type: DataTypes.FLOAT, // grams
            allowNull: true
        },
        carbs: {
            type: DataTypes.FLOAT, // grams
            allowNull: true
        },
        fats: {
            type: DataTypes.FLOAT, // grams
            allowNull: true
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    });

    // Goals tracking
    const Goal = sequelize.define('Goal', {
        type: {
            type: DataTypes.ENUM('weight', 'exercise', 'calories'),
            allowNull: false
        },
        targetValue: {
            type: DataTypes.FLOAT,
            allowNull: false
        },
        currentValue: {
            type: DataTypes.FLOAT,
            allowNull: true
        },
        deadline: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        completed: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    });

    // Warmup / stretching routines
    const Routine = sequelize.define('Routine', {
        name:  { type: DataTypes.STRING, allowNull: false },
        type:  { type: DataTypes.STRING, allowNull: false, defaultValue: 'warmup' }, // warmup, stretching, cooldown
        notes: { type: DataTypes.TEXT,   allowNull: true },
        items: { type: DataTypes.TEXT,   allowNull: true, defaultValue: '[]' }, // JSON array of { name, duration, reps, sets, notes }
    });

    // Recurring weekly schedule profile (one record per user)
    const ScheduleProfile = sequelize.define('ScheduleProfile', {
        workDays:       { type: DataTypes.TEXT, allowNull: true }, // JSON "[1,2,3,4,5]"
        workShiftStart: { type: DataTypes.STRING, allowNull: true },
        workShiftEnd:   { type: DataTypes.STRING, allowNull: true },
        bjjDays:        { type: DataTypes.TEXT, allowNull: true },
        muayThaiDays:   { type: DataTypes.TEXT, allowNull: true },
        openMatDays:    { type: DataTypes.TEXT, allowNull: true },
    });

    // Competition events
    const Competition = sequelize.define('Competition', {
        name:                 { type: DataTypes.STRING, allowNull: false },
        sport:                { type: DataTypes.STRING, allowNull: false, defaultValue: 'other' },
        date:                 { type: DataTypes.DATEONLY, allowNull: false },
        location:             { type: DataTypes.STRING, allowNull: true },
        weightClass:          { type: DataTypes.STRING, allowNull: true },
        registrationDeadline: { type: DataTypes.DATEONLY, allowNull: true },
        notes:                { type: DataTypes.TEXT, allowNull: true },
        isActive:             { type: DataTypes.BOOLEAN, defaultValue: true },
        result:               { type: DataTypes.STRING, allowNull: true },
    });

    // Individual training sessions (planned or logged)
    const TrainingSession = sequelize.define('TrainingSession', {
        date:            { type: DataTypes.DATEONLY, allowNull: false },
        type:            { type: DataTypes.STRING,  allowNull: false }, // strength, conditioning, technique, recovery, bjj, muay_thai, open_mat, gym_work
        title:           { type: DataTypes.STRING,  allowNull: true },
        plannedDuration: { type: DataTypes.INTEGER, allowNull: true },  // minutes
        status:          { type: DataTypes.STRING,  allowNull: false, defaultValue: 'planned' }, // planned, completed, partial, missed
        actualDuration:  { type: DataTypes.INTEGER, allowNull: true },
        effort:          { type: DataTypes.INTEGER, allowNull: true },  // 1-5
        energy:          { type: DataTypes.INTEGER, allowNull: true },  // 1-5
        notes:           { type: DataTypes.TEXT,    allowNull: true },
        competitionId:   { type: DataTypes.INTEGER, allowNull: true },
        missedReason:    { type: DataTypes.STRING,  allowNull: true },
    });

    return {
        sequelize,
        WeightEntry,
        Exercise,
        Meal,
        Goal,
        Routine,
        ScheduleProfile,
        Competition,
        TrainingSession,
    };
};

module.exports = getDatabase;
