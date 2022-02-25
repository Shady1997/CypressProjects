export class LoginPage{

    login_username_id = '#uname'
    login_password_id = '#pwd'
    login_button_id = '[type="submit"]'

    navigateToURL(url){
        cy.visit(url)
    }
    enterUserName(userName){
        cy.get(this.login_username_id).type(userName)
    }
    enterPassword(password){
        cy.get(this.login_password_id).type(password)
    }
    clickLoginButton(){
        cy.get(this.login_button_id).click()
        cy.get('h1',{timeout:6000})
        .should('contain','Your Website to practice Automation Testing')
        .should('be.visible')
        // .should('have.class','header')

    }
}