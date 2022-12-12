const express = require("express");
const bcrypt = require("bcryptjs");
const { check, validationResult } = require("express-validator");
const User = require("../models/User");
const { generateUserData } = require("../utils/helpers");
const tokenService = require("../services/token.service");
const Token = require("../models/Token");
const router = express.Router({ mergeParams: true });

// добавление нового юзера

router.post("/signUp", [
  // влидация данных
  check("email", "Некорректный email").isEmail(),
  check("password", "Длина пароля должна быть минимум 8 символов").isLength({
    min: 8,
  }),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            message: "INVALID_DATA",
            code: 400,
            // errors: errors.array(), - чтобы узнать где именно произошла ошибка
          },
        });
      }

      const { email, password } = req.body;

      // ищем в БД юзера с указанным email (передаем его в запросе post) и если такой email есть - возвращаем ошибку
      const exitingUser = await User.findOne({ email });
      if (exitingUser) {
        return res
          .status(400)
          .json({ error: { message: "EMAIL_EXISTS", code: 400 } });
      }

      // кодируем пароль
      const hashedPassword = await bcrypt.hash(password, 12);

      // создаем нового юзера с данными которые отправили, generateUserData() - создает нам рандомно значения переменных: rate, image, completedMeetings, остальные переменные передаются из запроса (request)
      const newUser = await User.create({
        // здесь мы добавляем переменные rate, image, completedMeetings
        ...generateUserData(),
        // здесь мы добавляем email
        ...req.body,
        // здесь мы добавляем зашифрованный пароль
        password: hashedPassword,
      });

      // генерируем токены (accessToken, refreshToken, expiresIn) на основе функции tokenService из token.service.js
      const tokens = tokenService.generate({ _id: newUser._id });
      await tokenService.save(newUser._id, tokens.refreshToken);

      res.status(201).send({ ...tokens, userId: newUser._id });
    } catch (error) {
      res.status(500).json({
        message: "На сервере произошла ошибка",
      });
    }
  },
]);

// авторизация с помощью логина и пароля

router.post("/signInWithPassword", [
  // валидация данных
  check("email", "Email введен некорректно").normalizeEmail().isEmail(),
  check("password", "Пароль не должен быть пустым").exists(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty) {
        return res.status(400).json({
          error: {
            message: "INVALID_DATA",
            code: 400,
          },
        });
      }
      const { email, password } = req.body;
      const existingUser = await User.findOne({ email });
      if (!existingUser) {
        return res.status(400).send({
          error: {
            message: "EMAIL_NOT_FOUND",
            code: 400,
          },
        });
      }

      const isPasswordEqual = await bcrypt.compare(
        password,
        existingUser.password
      );
      if (!isPasswordEqual) {
        return res.status(400).send({
          error: {
            message: "INVALID_PASSWORD",
            code: 400,
          },
        });
      }

      const tokens = tokenService.generate({ _id: existingUser._id });
      await tokenService.save(existingUser._id, tokens.refreshToken);

      res.status(200).send({ ...tokens, userId: existingUser._id });
    } catch (error) {
      res.status(500).json({
        message: "На сервере произошла ошибка",
      });
    }
  },
]);

// обновление refreshToken

function isTokenInvalid(data, dbToken) {
  return !data || !dbToken || data._id !== dbToken?.user?.toString();
}

router.post("/token", async (req, res) => {
  try {
    const { refresh_token: refreshToken } = req.body;
    const data = tokenService.validateRefresh(refreshToken);
    const dbToken = await tokenService.findToken(refreshToken);

    if (isTokenInvalid(data, dbToken)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const tokens = await tokenService.generate({
      _id: data._id,
    });

    await tokenService.save(data._id, refreshToken);

    res.status(200).send({ ...tokens, userId: data._id });
  } catch (error) {
    res.status(500).json({
      message: "На сервере произошла ошибка",
    });
  }
});

module.exports = router;
