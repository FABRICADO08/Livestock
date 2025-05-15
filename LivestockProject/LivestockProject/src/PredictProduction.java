/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

/**
 *
 * @author 202002208
 */
import java.util.Scanner;
public class PredictProduction {
     public void Product() {
        
        int day=0,daycount=0,month=0,year=0;
        int users =2; 
       
        Scanner inputint = new Scanner(System.in); //scanner for integers
        Scanner inputstr = new Scanner(System.in); //scanner for strings
         
        String[] name     = new String[users];
        String[] surname  = new String[users];
        String[] location = new String[users];
        String[] gender   = new String[users];
        String[]  DateOfBirth     = new String[users];
       
        int[] bulls = new int[users];
        int[] cows  = new int[users];
        int[] m_num = new int[users];
        int[] stock = new int[users];
         
        System.out.println("Want to estimate for another member? if yes press '1' if no press '2'");
        int answer=inputint.nextInt();
        
        switch(answer){
        
            case 1:
        for (int i = 0;i<users;i++){
            
            System.out.println("Enter member number");
            m_num[i] = inputint.nextInt();
            
            System.out.println("Enter member's name");
            name[i] =inputstr.nextLine();
            
            System.out.println("Enter member's surname");
            surname[i] =inputstr.nextLine();
            
            System.out.println("Enter member's date of birth");
            DateOfBirth[i] =inputstr.nextLine();
            
            System.out.println("Enter member's location");
            location[i] =inputstr.nextLine();
            
            System.out.println("Enter initial number of cow(s) and  bull(s) silmateniously \n"+"Following the ratio of 2bulls/100cows for a period of 5years ");
             bulls[i] = inputint.nextInt();
             cows[i] = inputint.nextInt();
             
              LivestockProject livestock = new LivestockProject(m_num[i],name[i],surname[i],DateOfBirth[i],gender[i],location[i],bulls[i],cows[i],month,year,daycount,day);
             System.out.println("For member "+ name[i]+" "+surname[i]+" "+m_num[i]);
             livestock.setEstimation(cows[i]);    
             };
             break;
            case 2 : System.out.println("Bye bye");
                    
            break;
            default : System.out.println("Wrong input bye");
            break;
       
    }
}

    
}
