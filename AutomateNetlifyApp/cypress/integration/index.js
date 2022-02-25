import { LoginPage } from "../pages/login_page"

let loginPage =new LoginPage()

it('login to home page', function(){
    //navigate to web page
   loginPage.navigateToURL('https://trytestingthis.netlify.app/')
   //add user name
   loginPage.enterUserName('test')
   //add password
   loginPage.enterPassword('test')
   //click login button
   loginPage.clickLoginButton()
})