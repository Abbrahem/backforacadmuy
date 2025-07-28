const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['student', 'parent', 'teacher', 'admin'],
    required: true
  },
  isApproved: {
    type: Boolean,
    default: function() {
      return this.role === 'student' || this.role === 'parent' || this.role === 'admin';
    }
  },
  // Student specific fields
  studentId: {
    type: String,
    unique: true,
    sparse: true // Only required for students
  },
  grade: {
    type: String,
    required: function() { return this.role === 'student'; }
  },
  division: {
    type: String,
    required: function() { 
      return this.role === 'student' && ['الأول الثانوي', 'الثاني الثانوي', 'الثالث الثانوي'].includes(this.grade);
    }
  },
  
  // Parent specific fields
  childStudentId: {
    type: String,
    required: function() { return this.role === 'parent'; }
  },
  
  // Teacher specific fields
  experience: {
    type: String,
    required: function() { return this.role === 'teacher'; }
  },
  subject: {
    type: String,
    required: function() { return this.role === 'teacher'; }
  },
  qualifications: {
    type: String,
    required: function() { return this.role === 'teacher'; }
  },
  
  // Common fields
  phone: String,
  avatar: String,
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Generate unique student ID for students
userSchema.pre('save', async function(next) {
  if (this.role === 'student' && !this.studentId) {
    const count = await mongoose.model('User').countDocuments({ role: 'student' });
    this.studentId = `STU${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model('User', userSchema);
