# -*- coding: utf-8 -*-


class Person:

    '''Personクラス'''

    # 他言語のコンストラクタみたいなもの
    def __init__(self, name, age, sex):
        # インスタンス変数
        self.name = name
        self.age = age
        # プライベートインスタンス変数
        self.__sex = sex

    # クラス変数
    pub_class_value = 'yeeeeeeeeeah!!!!!!!!!!!'
    # プライベートクラス変数
    __pri_class_value = 'Hmmm....'

    # メソッド
    def greet(self):
        print('Hello, my name is ' + self.name +
              ' and I am ' + str(self.age) + ' years old.')
        # self.__my_secret()

    # プライベートメソッド
    def __my_secret(self):
        print('my secret')

    # クラスメソッド
    @classmethod
    def pub_class_name(cls):
        print('public class method')

    # プライベートクラスメソッド
    @classmethod
    def __pri_class_name(cls):
        print('private class method')


class SuperPerson(Person):

    '''Personクラスの継承'''

    def shout(self):
        print('Hi, I am ' + self.name + '!!!!!!!!!!')


if __name__ == '__main__':
    # インスタンス生成
    taro = Person('Taro', 25, 'Man')

    # メソッドを呼び出す
    taro.greet()
    # taro.__my_secret()  # エラー

    # オブジェクトが返ってくる
    # print(taro)

    # オブジェクトの中身
    # import inspect
    # for data in inspect.getmembers(taro):
    #     print(data)

    # いろんな属性名
    # print(dir(taro))

    # インスタンス変数にアクセス
    # print(taro.name)
    # print(taro.age)
    # print(taro.sex)     # エラー
    # print(taro.__sex)   # エラー
    # print(taro._Person__sex)

    # 継承
    # jiro = SuperPerson('Jiro', 20, 'Man')
    # jiro.greet()
    # jiro.shout()

    # クラス変数へアクセス
    # print(Person.pub_class_value)
    # print(Person.__pri_class_value) # エラー

    # クラスメソッドへのアクセス
    # Person.pub_class_name()
    # Person.__pri_class_name() # エラー